import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'

// Validate UUID format
function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const yearStr = searchParams.get('year')
  const monthStr = searchParams.get('month')

  // Validate required params
  if (!propertyId || !yearStr || !monthStr) {
    return NextResponse.json(
      { error: 'validation_error', message: 'property_id, year, and month are required' },
      { status: 400 }
    )
  }

  if (!isUUID(propertyId)) {
    return NextResponse.json(
      { error: 'validation_error', message: 'property_id must be a valid UUID' },
      { status: 400 }
    )
  }

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: 'validation_error', message: 'year must be a valid number (2000–2100)' },
      { status: 400 }
    )
  }

  if (isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'validation_error', message: 'month must be between 1 and 12' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // For non-CO users, verify they have access to this property
  const userPropertyIds = await getUserPropertyIds(user)
  if (userPropertyIds !== null) {
    if (!userPropertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  // Calculate date range for the month
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDayDate = new Date(year, month, 0) // day 0 of next month = last day of this month
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`
  const daysInMonth = lastDayDate.getDate()

  // Fetch all data in parallel
  const [
    departmentsResult,
    posTerminalsResult,
    dailyReportsResult,
    cashCollectionsResult,
  ] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name, sort_order')
      .eq('property_id', propertyId)
      .eq('status', 'ACTIVE')
      .order('sort_order')
      .order('name'),

    supabase
      .from('pos_terminals')
      .select('id, tid, bank')
      .eq('property_id', propertyId)
      .eq('status', 'ACTIVE')
      .order('tid'),

    supabase
      .from('daily_reports')
      .select('id, date, department_id')
      .eq('property_id', propertyId)
      .gte('date', firstDay)
      .lte('date', lastDay),

    supabase
      .from('cash_collections')
      .select('collection_date, amount, collected_by_id, user_profiles!collected_by_id(full_name)')
      .eq('property_id', propertyId)
      .gte('collection_date', firstDay)
      .lte('collection_date', lastDay),
  ])

  if (departmentsResult.error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }
  if (posTerminalsResult.error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }
  if (dailyReportsResult.error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }
  if (cashCollectionsResult.error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const departments = departmentsResult.data ?? []
  const posTerminals = posTerminalsResult.data ?? []
  const dailyReports = dailyReportsResult.data ?? []
  const cashCollections = cashCollectionsResult.data ?? []

  // If there are daily reports, fetch their lines and POS entries
  let reportLines: Array<{
    daily_report_id: string
    department_id: string
    cash_income: number
    cash_return: number
    cash_net: number
  }> = []

  let posEntries: Array<{
    daily_report_id: string
    pos_terminal_id: string
    amount: number
    return_amount: number
    net_amount: number
  }> = []

  if (dailyReports.length > 0) {
    const reportIds = dailyReports.map((r) => r.id)

    const [linesResult, posEntriesResult] = await Promise.all([
      supabase
        .from('daily_report_lines')
        .select('daily_report_id, department_id, cash_income, cash_return, cash_net')
        .in('daily_report_id', reportIds),

      supabase
        .from('pos_entries')
        .select('daily_report_id, pos_terminal_id, amount, return_amount, net_amount')
        .in('daily_report_id', reportIds),
    ])

    if (linesResult.error) {
      return NextResponse.json({ error: 'database_error' }, { status: 500 })
    }
    if (posEntriesResult.error) {
      return NextResponse.json({ error: 'database_error' }, { status: 500 })
    }

    reportLines = linesResult.data ?? []
    posEntries = posEntriesResult.data ?? []
  }

  // Build lookup maps for efficient aggregation
  // reportId -> date
  const reportDateMap = new Map<string, string>()
  for (const r of dailyReports) {
    reportDateMap.set(r.id, r.date)
  }

  // date -> { department_id -> cash_net total }
  const cashByDateDept = new Map<string, Map<string, number>>()
  // date -> { department_id -> cash_return total } (reversals)
  const reversalByDateDept = new Map<string, Map<string, number>>()

  for (const line of reportLines) {
    const date = reportDateMap.get(line.daily_report_id)
    if (!date) continue

    if (!cashByDateDept.has(date)) cashByDateDept.set(date, new Map())
    if (!reversalByDateDept.has(date)) reversalByDateDept.set(date, new Map())

    const deptCashMap = cashByDateDept.get(date)!
    const prev = deptCashMap.get(line.department_id) ?? 0
    deptCashMap.set(line.department_id, prev + Number(line.cash_net))

    const deptRevMap = reversalByDateDept.get(date)!
    const prevRev = deptRevMap.get(line.department_id) ?? 0
    deptRevMap.set(line.department_id, prevRev + Number(line.cash_return))
  }

  // date -> { terminal_id -> net_amount total }
  const posByDateTerminal = new Map<string, Map<string, number>>()
  // date -> { terminal_id -> return_amount total } (reversals)
  const posRevByDateTerminal = new Map<string, Map<string, number>>()

  for (const entry of posEntries) {
    const date = reportDateMap.get(entry.daily_report_id)
    if (!date) continue

    if (!posByDateTerminal.has(date)) posByDateTerminal.set(date, new Map())
    if (!posRevByDateTerminal.has(date)) posRevByDateTerminal.set(date, new Map())

    const termMap = posByDateTerminal.get(date)!
    const prev = termMap.get(entry.pos_terminal_id) ?? 0
    termMap.set(entry.pos_terminal_id, prev + Number(entry.net_amount))

    const termRevMap = posRevByDateTerminal.get(date)!
    const prevRev = termRevMap.get(entry.pos_terminal_id) ?? 0
    termRevMap.set(entry.pos_terminal_id, prevRev + Number(entry.return_amount))
  }

  // date -> collection
  const collectionByDate = new Map<
    string,
    { amount: number; collected_by: string | null }
  >()
  for (const col of cashCollections) {
    // If multiple collections on same date, sum amounts; use last collector name
    const prev = collectionByDate.get(col.collection_date)
    const profileData = col.user_profiles as unknown as { full_name: string } | null
    const collectorName = profileData?.full_name ?? null
    if (prev) {
      collectionByDate.set(col.collection_date, {
        amount: prev.amount + Number(col.amount),
        collected_by: collectorName ?? prev.collected_by,
      })
    } else {
      collectionByDate.set(col.collection_date, {
        amount: Number(col.amount),
        collected_by: collectorName,
      })
    }
  }

  // Build per-day rows
  const days = []
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // Section 1: cash by department
    const deptCashMap = cashByDateDept.get(dateStr) ?? new Map<string, number>()
    const deptRevMap = reversalByDateDept.get(dateStr) ?? new Map<string, number>()

    const cash_by_department: Record<string, number> = {}
    let reversal_total = 0
    let cash_total = 0

    for (const dept of departments) {
      const net = deptCashMap.get(dept.id) ?? 0
      cash_by_department[dept.id] = net
      cash_total += net
      reversal_total += deptRevMap.get(dept.id) ?? 0
    }

    // Section 2: collection
    const collection = collectionByDate.get(dateStr)
    const collected_amount = collection?.amount ?? 0
    const collected_by = collection?.collected_by ?? null
    const cash_difference = cash_total - collected_amount

    // Section 3: POS
    const termMap = posByDateTerminal.get(dateStr) ?? new Map<string, number>()
    const termRevMap = posRevByDateTerminal.get(dateStr) ?? new Map<string, number>()

    const pos_by_terminal: Record<string, number> = {}
    let pos_reversal_total = 0
    let pos_total = 0

    for (const terminal of posTerminals) {
      const net = termMap.get(terminal.id) ?? 0
      pos_by_terminal[terminal.id] = net
      pos_total += net
      pos_reversal_total += termRevMap.get(terminal.id) ?? 0
    }

    const pos_difference = pos_total - 0 // placeholder; no POS collection target in schema

    days.push({
      date: dateStr,
      day,
      cash_by_department,
      reversal_total,
      cash_total,
      collected_amount,
      collected_by,
      cash_difference,
      pos_by_terminal,
      pos_reversal_total,
      pos_total,
      pos_difference,
    })
  }

  // Build totals
  const totals_cash_by_department: Record<string, number> = {}
  const totals_pos_by_terminal: Record<string, number> = {}
  let totals_reversal_total = 0
  let totals_cash_total = 0
  let totals_collected_total = 0
  let totals_cash_difference_total = 0
  let totals_pos_reversal_total = 0
  let totals_pos_total = 0

  for (const dept of departments) {
    totals_cash_by_department[dept.id] = 0
  }
  for (const terminal of posTerminals) {
    totals_pos_by_terminal[terminal.id] = 0
  }

  for (const dayRow of days) {
    for (const deptId of Object.keys(dayRow.cash_by_department)) {
      totals_cash_by_department[deptId] =
        (totals_cash_by_department[deptId] ?? 0) + dayRow.cash_by_department[deptId]
    }
    for (const termId of Object.keys(dayRow.pos_by_terminal)) {
      totals_pos_by_terminal[termId] =
        (totals_pos_by_terminal[termId] ?? 0) + dayRow.pos_by_terminal[termId]
    }
    totals_reversal_total += dayRow.reversal_total
    totals_cash_total += dayRow.cash_total
    totals_collected_total += dayRow.collected_amount
    totals_cash_difference_total += dayRow.cash_difference
    totals_pos_reversal_total += dayRow.pos_reversal_total
    totals_pos_total += dayRow.pos_total
  }

  return NextResponse.json({
    property_id: propertyId,
    year,
    month,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    pos_terminals: posTerminals.map((t) => ({ id: t.id, tid: t.tid, bank: t.bank })),
    days,
    totals: {
      cash_by_department: totals_cash_by_department,
      reversal_total: totals_reversal_total,
      cash_total: totals_cash_total,
      collected_total: totals_collected_total,
      cash_difference_total: totals_cash_difference_total,
      pos_by_terminal: totals_pos_by_terminal,
      pos_reversal_total: totals_pos_reversal_total,
      pos_total: totals_pos_total,
    },
  })
}
