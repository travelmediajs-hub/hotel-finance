import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const year = parseInt(searchParams.get('year') ?? '')
  const month = parseInt(searchParams.get('month') ?? '')

  if (!propertyId || !year || !month) {
    return NextResponse.json({ error: 'property_id, year, month required' }, { status: 400 })
  }

  const supabase = await createClient()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`
  const yearStart = `${year}-01-01`

  const { data: templates } = await supabase
    .from('usali_department_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const { data: accounts } = await supabase
    .from('usali_accounts')
    .select('*')
    .eq('is_active', true)
    .eq('level', 3)

  async function getAmounts(dateFrom: string, dateTo: string) {
    const [{ data: income }, { data: expenses }] = await Promise.all([
      supabase
        .from('income_entries')
        .select('account_id, amount')
        .eq('property_id', propertyId!)
        .gte('entry_date', dateFrom)
        .lt('entry_date', dateTo),
      supabase
        .from('expenses')
        .select('account_id, amount_net, vat_amount')
        .eq('property_id', propertyId!)
        .gte('issue_date', dateFrom)
        .lt('issue_date', dateTo)
        .neq('status', 'REJECTED'),
    ])

    const rev = new Map<string, number>()
    for (const r of income ?? []) {
      rev.set(r.account_id, (rev.get(r.account_id) ?? 0) + Number(r.amount))
    }
    const exp = new Map<string, number>()
    for (const e of expenses ?? []) {
      const total = Number(e.amount_net) + Number(e.vat_amount)
      exp.set(e.account_id, (exp.get(e.account_id) ?? 0) + total)
    }
    return { rev, exp }
  }

  const current = await getAmounts(monthStart, monthEnd)
  const ytd = await getAmounts(yearStart, monthEnd)

  function sumForTemplate(templateId: string, type: 'REVENUE' | 'EXPENSE', amounts: { rev: Map<string, number>; exp: Map<string, number> }) {
    const map = type === 'REVENUE' ? amounts.rev : amounts.exp
    let total = 0
    for (const acc of accounts ?? []) {
      if (acc.template_id === templateId && acc.account_type === type) {
        total += map.get(acc.id) ?? 0
      }
    }
    return total
  }

  const operated = (templates ?? []).filter(t => t.category === 'OPERATED')
  const undistributed = (templates ?? []).filter(t => t.category === 'UNDISTRIBUTED')
  const fixed = (templates ?? []).filter(t => t.category === 'FIXED')

  const operatedDepartments = operated.map(t => ({
    template: { code: t.code, name: t.name },
    profit: sumForTemplate(t.id, 'REVENUE', current) - sumForTemplate(t.id, 'EXPENSE', current),
    profitYtd: sumForTemplate(t.id, 'REVENUE', ytd) - sumForTemplate(t.id, 'EXPENSE', ytd),
  }))

  const totalDeptProfit = operatedDepartments.reduce((s, d) => s + d.profit, 0)
  const totalDeptProfitYtd = operatedDepartments.reduce((s, d) => s + d.profitYtd, 0)

  const undistributedItems = undistributed.map(t => ({
    template: { code: t.code, name: t.name },
    amount: sumForTemplate(t.id, 'EXPENSE', current),
    amountYtd: sumForTemplate(t.id, 'EXPENSE', ytd),
  }))

  const totalUndist = undistributedItems.reduce((s, d) => s + d.amount, 0)
  const totalUndistYtd = undistributedItems.reduce((s, d) => s + d.amountYtd, 0)

  const gop = totalDeptProfit - totalUndist
  const gopYtd = totalDeptProfitYtd - totalUndistYtd

  const fixedCharges = fixed.map(t => ({
    template: { code: t.code, name: t.name },
    amount: sumForTemplate(t.id, 'EXPENSE', current),
    amountYtd: sumForTemplate(t.id, 'EXPENSE', ytd),
  }))

  const totalFixed = fixedCharges.reduce((s, d) => s + d.amount, 0)
  const totalFixedYtd = fixedCharges.reduce((s, d) => s + d.amountYtd, 0)

  const noi = gop - totalFixed
  const noiYtd = gopYtd - totalFixedYtd

  let totalRev = 0
  let totalRevYtd = 0
  for (const t of operated) {
    totalRev += sumForTemplate(t.id, 'REVENUE', current)
    totalRevYtd += sumForTemplate(t.id, 'REVENUE', ytd)
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .single()

  return NextResponse.json({
    property: property ?? { id: propertyId, name: '' },
    period: { year, month },
    operatedDepartments,
    totalDepartmentalProfit: totalDeptProfit,
    totalDepartmentalProfitYtd: totalDeptProfitYtd,
    undistributed: undistributedItems,
    totalUndistributed: totalUndist,
    totalUndistributedYtd: totalUndistYtd,
    gop,
    gopYtd,
    gopPercent: totalRev > 0 ? (gop / totalRev) * 100 : 0,
    gopPercentYtd: totalRevYtd > 0 ? (gopYtd / totalRevYtd) * 100 : 0,
    fixedCharges,
    totalFixed,
    totalFixedYtd,
    noi,
    noiYtd,
    noiPercent: totalRev > 0 ? (noi / totalRev) * 100 : 0,
    noiPercentYtd: totalRevYtd > 0 ? (noiYtd / totalRevYtd) * 100 : 0,
  })
}
