import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'

export async function GET(req: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('property_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Access control
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds !== null) {
    if (!propertyId || !allowedIds.includes(propertyId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const supabase = await createClient()

  // Get balance(s)
  let balanceQuery = supabase.from('property_cash_balances').select('*')
  if (propertyId) {
    balanceQuery = balanceQuery.eq('property_id', propertyId)
  }
  const { data: balances, error: balErr } = await balanceQuery
  if (balErr) {
    return NextResponse.json({ error: balErr.message }, { status: 500 })
  }

  if (!propertyId) {
    return NextResponse.json({ balances, movements: [] })
  }

  // Get register for date filtering
  const register = balances?.[0]
  if (!register) {
    return NextResponse.json({ balances: [], movements: [] })
  }

  const dateFrom = from || register.opening_balance_date
  const dateTo = to || '2099-12-31'

  // Fetch movements from all sources
  const [dailyRes, withdrawalRes, collectionRes, receivedRes, transitInRes, transitOutRes] = await Promise.all([
    // Daily reports cash
    supabase
      .from('daily_reports')
      .select('id, date, total_cash_net, daily_report_lines(cash_net, department_id, departments(name))')
      .eq('property_id', propertyId)
      .in('status', ['APPROVED', 'CORRECTED'])
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false }),

    // Withdrawals
    supabase
      .from('withdrawals')
      .select('id, withdrawal_date, amount, withdrawn_by, description, purpose')
      .eq('property_id', propertyId)
      .in('status', ['APPROVED', 'ACCOUNTED'])
      .eq('is_void', false)
      .gte('withdrawal_date', dateFrom)
      .lte('withdrawal_date', dateTo)
      .order('withdrawal_date', { ascending: false }),

    // Cash collections
    supabase
      .from('cash_collections')
      .select('id, collection_date, amount, note')
      .eq('property_id', propertyId)
      .in('status', ['SENT', 'RECEIVED', 'ACCOUNTED'])
      .gte('collection_date', dateFrom)
      .lte('collection_date', dateTo)
      .order('collection_date', { ascending: false }),

    // Money received
    supabase
      .from('money_received')
      .select('id, sent_date, amount, purpose, purpose_description')
      .eq('property_id', propertyId)
      .in('status', ['RECEIVED', 'ACCOUNTED'])
      .gte('sent_date', dateFrom)
      .lte('sent_date', dateTo)
      .order('sent_date', { ascending: false }),

    // In-transit arriving TO property
    supabase
      .from('in_transits')
      .select('id, start_date_time, total_amount, description')
      .eq('destination_type', 'PROPERTY_CASH')
      .eq('destination_id', propertyId)
      .eq('status', 'CLOSED')
      .gte('start_date_time', dateFrom)
      .lte('start_date_time', dateTo)
      .order('start_date_time', { ascending: false }),

    // In-transit leaving FROM property
    supabase
      .from('in_transit_sources')
      .select('id, amount, in_transits!inner(id, start_date_time, description, status)')
      .eq('source_type', 'PROPERTY_CASH')
      .eq('source_id', propertyId)
      .eq('in_transits.status', 'CLOSED')
      .gte('in_transits.start_date_time', dateFrom)
      .lte('in_transits.start_date_time', dateTo),
  ])

  // Build unified movements list
  type Movement = { date: string; type: string; description: string; income: number | null; expense: number | null; reference_id: string }
  const movements: Movement[] = []

  const purposeLabels: Record<string, string> = {
    PAY_EXP: 'Плащане разход', PAY_SAL: 'Заплата', ADV_EMP: 'Аванс служител',
    ADV_OPS: 'Аванс операт.', BANK_IN: 'Внос в банка', CASH_TRANS: 'Трансфер каса',
    CO_COLLECT: 'Инкасация ЦО', OTHER: 'Друго',
  }

  const receivedPurposeLabels: Record<string, string> = {
    OPERATIONAL: 'Оперативни', SALARIES: 'Заплати', CASH_SUPPLY: 'Захранване каса',
    SPECIFIC_GOAL: 'Целеви', ADVANCE: 'Аванс',
  }

  // Daily reports
  for (const dr of dailyRes.data ?? []) {
    if (dr.total_cash_net !== 0) {
      movements.push({
        date: dr.date,
        type: 'daily_report',
        description: `Дневен отчет ${dr.date}`,
        income: Number(dr.total_cash_net) > 0 ? Number(dr.total_cash_net) : null,
        expense: Number(dr.total_cash_net) < 0 ? Math.abs(Number(dr.total_cash_net)) : null,
        reference_id: dr.id,
      })
    }
  }

  // Withdrawals
  for (const w of withdrawalRes.data ?? []) {
    movements.push({
      date: typeof w.withdrawal_date === 'string' ? w.withdrawal_date.split('T')[0] : w.withdrawal_date,
      type: 'withdrawal',
      description: `${purposeLabels[w.purpose] ?? w.purpose} — ${w.withdrawn_by}${w.description ? ': ' + w.description : ''}`,
      income: null,
      expense: Number(w.amount),
      reference_id: w.id,
    })
  }

  // Cash collections
  for (const cc of collectionRes.data ?? []) {
    movements.push({
      date: cc.collection_date,
      type: 'cash_collection',
      description: `Инкасация${cc.note ? ': ' + cc.note : ''}`,
      income: null,
      expense: Number(cc.amount),
      reference_id: cc.id,
    })
  }

  // Money received
  for (const mr of receivedRes.data ?? []) {
    movements.push({
      date: mr.sent_date,
      type: 'money_received',
      description: `Получени средства — ${receivedPurposeLabels[mr.purpose] ?? mr.purpose}${mr.purpose_description ? ': ' + mr.purpose_description : ''}`,
      income: Number(mr.amount),
      expense: null,
      reference_id: mr.id,
    })
  }

  // Transfers in
  for (const t of transitInRes.data ?? []) {
    movements.push({
      date: typeof t.start_date_time === 'string' ? t.start_date_time.split('T')[0] : t.start_date_time,
      type: 'transfer_in',
      description: `Входящ трансфер: ${t.description}`,
      income: Number(t.total_amount),
      expense: null,
      reference_id: t.id,
    })
  }

  // Transfers out
  for (const ts of transitOutRes.data ?? []) {
    const it = ts.in_transits as any
    movements.push({
      date: typeof it.start_date_time === 'string' ? it.start_date_time.split('T')[0] : it.start_date_time,
      type: 'transfer_out',
      description: `Изходящ трансфер: ${it.description}`,
      income: null,
      expense: Number(ts.amount),
      reference_id: it.id,
    })
  }

  // Sort by date descending
  movements.sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ balances, movements })
}
