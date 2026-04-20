import { createClient } from '@/lib/supabase/server'
import type {
  OpReportMatrix,
  OpReportMatrixRow,
  OpReportVatMode,
  OpReportCell,
} from '@/types/finance'
import { loadOpReportTemplate } from './template'
import { evaluateFormula, topologicalOrder } from './formula'
import { workingDaysFor } from './periods'

type MonthlyMap = Record<string, Record<number, number>>

async function fetchProperty(propertyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('id, rooms_main, rooms_annex, total_beds, operating_months, annual_rent')
    .eq('id', propertyId)
    .single()
  if (error || !data) throw new Error(`Property not found: ${propertyId}`)
  return data as {
    id: string
    rooms_main: number
    rooms_annex: number
    total_beds: number
    operating_months: number[]
    annual_rent: number
  }
}

async function fetchBudgets(propertyId: string, year: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('opreport_budgets')
    .select('row_id, month, amount')
    .eq('property_id', propertyId)
    .eq('year', year)
  if (error) throw new Error(`Failed to load budgets: ${error.message}`)
  return data ?? []
}

async function fetchExpenseActuals(
  propertyId: string,
  year: number,
  vatMode: OpReportVatMode,
  accountIds: string[],
): Promise<Array<{ account_id: string; month: number; total: number }>> {
  if (accountIds.length === 0) return []
  const supabase = await createClient()
  const col = vatMode === 'gross' ? 'total_amount' : 'amount_net'
  const start = `${year}-01-01`
  const end = `${year + 1}-01-01`
  const { data, error } = await supabase
    .from('expenses')
    .select(`account_id, issue_date, ${col}`)
    .eq('property_id', propertyId)
    .in('account_id', accountIds)
    .gte('issue_date', start)
    .lt('issue_date', end)
    .neq('status', 'REJECTED')
    .neq('status', 'RETURNED')
    .neq('status', 'DRAFT')
  if (error) throw new Error(`Failed to load expenses: ${error.message}`)

  const bucket = new Map<string, number>()
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const month = new Date(row.issue_date as string).getUTCMonth() + 1
    const key = `${row.account_id as string}_${month}`
    const amt = Number(row[col] ?? 0)
    bucket.set(key, (bucket.get(key) ?? 0) + amt)
  }
  const out: Array<{ account_id: string; month: number; total: number }> = []
  for (const [k, v] of bucket) {
    const [accountId, monthStr] = k.split('_')
    out.push({ account_id: accountId, month: parseInt(monthStr, 10), total: v })
  }
  return out
}

async function fetchIncomeActuals(
  propertyId: string,
  year: number,
  _vatMode: OpReportVatMode,
  accountIds: string[],
): Promise<Array<{ account_id: string; month: number; total: number }>> {
  if (accountIds.length === 0) return []
  const supabase = await createClient()
  const start = `${year}-01-01`
  const end = `${year + 1}-01-01`

  const { data, error } = await supabase
    .from('income_entries')
    .select('account_id, entry_date, amount')
    .eq('property_id', propertyId)
    .in('account_id', accountIds)
    .gte('entry_date', start)
    .lt('entry_date', end)
  if (error) throw new Error(`Failed to load income: ${error.message}`)

  const bucket = new Map<string, number>()
  for (const row of data ?? []) {
    const month = new Date(row.entry_date as string).getUTCMonth() + 1
    const key = `${row.account_id as string}_${month}`
    const gross = Number(row.amount ?? 0)
    bucket.set(key, (bucket.get(key) ?? 0) + gross)
  }
  const out: Array<{ account_id: string; month: number; total: number }> = []
  for (const [k, v] of bucket) {
    const [accountId, monthStr] = k.split('_')
    out.push({ account_id: accountId, month: parseInt(monthStr, 10), total: v })
  }
  return out
}

async function fetchPayrollActuals(
  propertyId: string,
  year: number,
): Promise<{ net_salary: Record<number, number>; contributions: Record<number, number> }> {
  const supabase = await createClient()
  const start = `${year}-01-01`
  const end = `${year + 1}-01-01`

  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, actual_salary')
    .eq('property_id', propertyId)
    .eq('is_active', true)
  if (error) throw new Error(`Failed to load employees: ${error.message}`)

  const empIds = (employees ?? []).map(e => e.id as string)
  const { data: schedules } = empIds.length > 0
    ? await supabase
        .from('employee_schedule')
        .select('employee_id, date, status')
        .in('employee_id', empIds)
        .gte('date', start)
        .lt('date', end)
    : { data: [] as Array<{ employee_id: string; date: string; status: string }> }

  const workDaysMap = new Map<string, number>()
  for (const s of schedules ?? []) {
    if (s.status !== 'WORK') continue
    const month = new Date(s.date as string).getUTCMonth() + 1
    const key = `${s.employee_id as string}_${month}`
    workDaysMap.set(key, (workDaysMap.get(key) ?? 0) + 1)
  }

  const net: Record<number, number> = {}
  const contrib: Record<number, number> = {}
  for (let m = 1; m <= 12; m++) { net[m] = 0; contrib[m] = 0 }

  const contributionsRate = 0.188
  for (const emp of (employees ?? []) as Array<{ id: string; actual_salary: number }>) {
    for (let m = 1; m <= 12; m++) {
      const daysInM = new Date(year, m, 0).getDate()
      const worked = workDaysMap.get(`${emp.id}_${m}`) ?? 0
      if (worked === 0) continue
      const pay = Number(emp.actual_salary) * (worked / daysInM)
      net[m] += pay
      contrib[m] += pay * contributionsRate
    }
  }

  return { net_salary: net, contributions: contrib }
}

async function fetchPropertyStatistics(propertyId: string, year: number) {
  const supabase = await createClient()
  const start = `${year}-01-01`
  const end = `${year + 1}-01-01`
  const { data, error } = await supabase
    .from('property_statistics')
    .select('date, rooms_available, rooms_sold, guests')
    .eq('property_id', propertyId)
    .gte('date', start)
    .lt('date', end)
  if (error) throw new Error(`Failed to load property_statistics: ${error.message}`)

  const byMonth = {
    rooms_available: {} as Record<number, number>,
    rooms_sold:      {} as Record<number, number>,
    guests:          {} as Record<number, number>,
  }
  for (let m = 1; m <= 12; m++) {
    byMonth.rooms_available[m] = 0
    byMonth.rooms_sold[m] = 0
    byMonth.guests[m] = 0
  }
  for (const s of data ?? []) {
    const m = new Date(s.date as string).getUTCMonth() + 1
    byMonth.rooms_available[m] += Number(s.rooms_available ?? 0)
    byMonth.rooms_sold[m]      += Number(s.rooms_sold ?? 0)
    byMonth.guests[m]          += Number(s.guests ?? 0)
  }
  return byMonth
}

function variancePct(plan: number | null, actual: number | null): number | null {
  if (plan === null || actual === null) return null
  if (plan === 0) return null
  return ((actual - plan) / plan) * 100
}

export async function computeOperationalReport(
  propertyId: string,
  year: number,
  vatMode: OpReportVatMode,
): Promise<OpReportMatrix> {
  const template = await loadOpReportTemplate()
  const property = await fetchProperty(propertyId)
  const budgets = await fetchBudgets(propertyId, year)
  const stats = await fetchPropertyStatistics(propertyId, year)
  const payroll = await fetchPayrollActuals(propertyId, year)

  const expenseAccountIds = new Set<string>()
  const revenueAccountIds = new Set<string>()
  for (const r of template) {
    if (r.row_type === 'EXPENSE') r.account_ids.forEach(id => expenseAccountIds.add(id))
    if (r.row_type === 'REVENUE') r.account_ids.forEach(id => revenueAccountIds.add(id))
  }
  const expenseActuals = await fetchExpenseActuals(propertyId, year, vatMode, [...expenseAccountIds])
  const incomeActuals  = await fetchIncomeActuals(propertyId,  year, vatMode, [...revenueAccountIds])

  const plan: MonthlyMap   = {}
  const actual: MonthlyMap = {}

  for (const r of template) {
    plan[r.row_key]   = {}
    actual[r.row_key] = {}
  }

  const rowById = new Map(template.map(r => [r.id, r]))
  for (const b of budgets) {
    const row = rowById.get(b.row_id as string)
    if (!row) continue
    plan[row.row_key][b.month as number] = Number(b.amount)
  }

  const opMonths = property.operating_months ?? []
  const monthlyRent = opMonths.length > 0 ? Number(property.annual_rent) / opMonths.length : 0

  const accountToRowKey = new Map<string, string[]>()
  for (const r of template) {
    for (const accId of r.account_ids) {
      const list = accountToRowKey.get(accId) ?? []
      list.push(r.row_key)
      accountToRowKey.set(accId, list)
    }
  }

  for (const e of expenseActuals) {
    const rowKeys = accountToRowKey.get(e.account_id) ?? []
    for (const k of rowKeys) {
      actual[k][e.month] = (actual[k][e.month] ?? 0) + e.total
    }
  }
  for (const i of incomeActuals) {
    const rowKeys = accountToRowKey.get(i.account_id) ?? []
    for (const k of rowKeys) {
      actual[k][i.month] = (actual[k][i.month] ?? 0) + i.total
    }
  }

  for (const r of template) {
    if (r.row_type === 'STAT') {
      for (let m = 1; m <= 12; m++) {
        let v: number | null = null
        switch (r.source) {
          case 'property.rooms_main':   v = property.rooms_main; break
          case 'property.rooms_annex':  v = property.rooms_annex; break
          case 'property.total_beds':   v = property.total_beds; break
          case 'period.working_days':   v = workingDaysFor(year, m, opMonths); break
          case 'property_statistics.rooms_available': v = stats.rooms_available[m]; break
          case 'property_statistics.rooms_sold':      v = stats.rooms_sold[m]; break
          case 'property_statistics.guests':          v = stats.guests[m]; break
        }
        if (r.source?.startsWith('property.') && !opMonths.includes(m)) v = 0
        if (v !== null) actual[r.row_key][m] = v
      }
    }
    if (r.row_type === 'PAYROLL') {
      for (let m = 1; m <= 12; m++) {
        if (r.source === 'payroll.net_salary')    actual[r.row_key][m] = payroll.net_salary[m] ?? 0
        if (r.source === 'payroll.contributions') actual[r.row_key][m] = payroll.contributions[m] ?? 0
      }
    }
    if (r.row_type === 'RENT') {
      for (const m of opMonths) actual[r.row_key][m] = monthlyRent
    }
  }

  const order = topologicalOrder(template.map(r => ({ row_key: r.row_key, formula: r.formula })))

  const evalColumn = (
    column: Record<string, number | null>,
  ): Record<string, number | null> => {
    const out: Record<string, number | null> = { ...column }
    for (const key of order) {
      const row = template.find(t => t.row_key === key)
      if (!row) continue
      if (row.row_type !== 'DERIVED') continue
      if (!row.formula) { out[key] = null; continue }
      out[key] = evaluateFormula(row.formula, out)
    }
    return out
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const planEvaluated: Record<number, Record<string, number | null>> = {}
  const actualEvaluated: Record<number, Record<string, number | null>> = {}
  for (const m of months) {
    const p: Record<string, number | null> = {}
    const a: Record<string, number | null> = {}
    for (const r of template) {
      p[r.row_key] = plan[r.row_key][m] ?? null
      a[r.row_key] = actual[r.row_key][m] ?? null
    }
    planEvaluated[m]   = evalColumn(p)
    actualEvaluated[m] = evalColumn(a)
  }

  const ytdPlan: Record<string, number | null> = {}
  const ytdActual: Record<string, number | null> = {}
  for (const r of template) {
    if (r.row_type === 'DERIVED') { ytdPlan[r.row_key] = null; ytdActual[r.row_key] = null; continue }
    let sumP = 0; let sumA = 0; let hasP = false; let hasA = false
    for (const m of months) {
      const p = plan[r.row_key][m]; if (p !== undefined) { sumP += p; hasP = true }
      const a = actual[r.row_key][m]; if (a !== undefined) { sumA += a; hasA = true }
    }
    ytdPlan[r.row_key]   = hasP ? sumP : null
    ytdActual[r.row_key] = hasA ? sumA : null
  }
  const ytdPlanEvaluated   = evalColumn(ytdPlan)
  const ytdActualEvaluated = evalColumn(ytdActual)

  const resultRows: OpReportMatrixRow[] = template.map(r => {
    const cells: Record<number, OpReportCell> = {}
    for (const m of months) {
      const p = planEvaluated[m][r.row_key] ?? null
      const a = actualEvaluated[m][r.row_key] ?? null
      cells[m] = { plan: p, actual: a, variance_pct: variancePct(p, a) }
    }
    const ytd: OpReportCell = {
      plan:   ytdPlanEvaluated[r.row_key] ?? null,
      actual: ytdActualEvaluated[r.row_key] ?? null,
      variance_pct: variancePct(ytdPlanEvaluated[r.row_key] ?? null, ytdActualEvaluated[r.row_key] ?? null),
    }
    return {
      row_key: r.row_key,
      label_bg: r.label_bg,
      section: r.section,
      row_type: r.row_type,
      display_format: r.display_format,
      indent_level: r.indent_level,
      cells,
      ytd,
    }
  })

  return {
    property_id: propertyId,
    year,
    vat_mode: vatMode,
    operating_months: opMonths,
    rows: resultRows,
  }
}
