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
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  // Fetch all OPERATED templates
  const { data: templates } = await supabase
    .from('usali_department_templates')
    .select('*')
    .eq('category', 'OPERATED')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch all accounts
  const { data: accounts } = await supabase
    .from('usali_accounts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch revenue (income_entries) for the property/period
  const { data: incomeRows } = await supabase
    .from('income_entries')
    .select('account_id, amount')
    .eq('property_id', propertyId)
    .gte('entry_date', dateFrom)
    .lt('entry_date', dateTo)

  // Fetch expenses for the property/period
  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('account_id, amount_net, vat_amount')
    .eq('property_id', propertyId)
    .gte('issue_date', dateFrom)
    .lt('issue_date', dateTo)
    .neq('status', 'REJECTED')

  // Fetch budgets for the period
  const { data: budgets } = await supabase
    .from('usali_budgets')
    .select('account_id, amount')
    .eq('property_id', propertyId)
    .eq('year', year)
    .eq('month', month)

  // Build lookup maps
  const budgetMap = new Map((budgets ?? []).map(b => [b.account_id, b.amount]))

  // Aggregate revenue by account
  const revByAccount = new Map<string, number>()
  for (const row of incomeRows ?? []) {
    revByAccount.set(row.account_id, (revByAccount.get(row.account_id) ?? 0) + Number(row.amount))
  }

  // Aggregate expenses by account
  const expByAccount = new Map<string, number>()
  for (const row of expenseRows ?? []) {
    const total = Number(row.amount_net) + Number(row.vat_amount)
    expByAccount.set(row.account_id, (expByAccount.get(row.account_id) ?? 0) + total)
  }

  // Helper: get level 2 accounts under a template, with level 3 amounts aggregated
  function getGroupedAmounts(templateId: string, type: 'REVENUE' | 'EXPENSE') {
    const amountMap = type === 'REVENUE' ? revByAccount : expByAccount
    const level2 = (accounts ?? []).filter(a => a.template_id === templateId && a.level === 2 && a.account_type === type)
    const groups = level2.map(l2 => {
      const children = (accounts ?? []).filter(a => a.parent_id === l2.id && a.level === 3)
      let amount = 0
      let budget = 0
      for (const child of children) {
        amount += amountMap.get(child.id) ?? 0
        budget += budgetMap.get(child.id) ?? 0
      }
      return { account: { code: l2.code, name: l2.name }, amount, budget }
    })
    const total = groups.reduce((s, g) => s + g.amount, 0)
    const totalBudget = groups.reduce((s, g) => s + g.budget, 0)
    return { groups, total, totalBudget }
  }

  // Build departmental report
  const departments = (templates ?? []).map(t => {
    const revenue = getGroupedAmounts(t.id, 'REVENUE')
    const expenses = getGroupedAmounts(t.id, 'EXPENSE')
    const profit = revenue.total - expenses.total
    const profitBudget = revenue.totalBudget - expenses.totalBudget
    const margin = revenue.total > 0 ? (profit / revenue.total) * 100 : 0

    return {
      template: { code: t.code, name: t.name },
      revenue,
      expenses,
      profit,
      profitBudget,
      margin,
    }
  })

  // Fetch property name
  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .single()

  return NextResponse.json({
    property: property ?? { id: propertyId, name: '' },
    period: { year, month },
    departments,
  })
}
