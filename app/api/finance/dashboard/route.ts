import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    accountsResult,
    balancesResult,
    lastTxResult,
    coCashResult,
    coCashBalancesResult,
    propertyCashResult,
    loansResult,
    loanBalancesResult,
    revolvingResult,
    revolvingBalancesResult,
    pendingExpensesResult,
    dailyReportsCountResult,
    consolidationsCountResult,
    unconfirmedCollectionsResult,
    unaccountedAdvancesResult,
  ] = await Promise.all([
    // 1. Bank accounts
    supabase
      .from('bank_accounts')
      .select('id, name, iban, bank, currency')
      .eq('status', 'ACTIVE'),

    // 2. Bank account balances
    supabase
      .from('bank_account_balances')
      .select('id, current_balance'),

    // 3. Last transaction per bank account
    supabase
      .from('bank_transactions')
      .select('bank_account_id, transaction_date')
      .order('transaction_date', { ascending: false }),

    // 4. CO cash registers
    supabase
      .from('co_cash')
      .select('id, name'),

    // 5. CO cash balances
    supabase
      .from('co_cash_balances')
      .select('id, current_balance'),

    // 5b. Property cash registers with balances
    supabase
      .from('property_cash_balances')
      .select('id, property_id, name, current_balance'),

    // 6. Loans (active)
    supabase
      .from('loans')
      .select('id, name, bank, principal_amount, monthly_payment, payment_day, status')
      .eq('status', 'ACTIVE'),

    // 7. Loan balances (includes next_payment_date and remaining_principal)
    supabase
      .from('loan_balances')
      .select('id, remaining_principal, next_payment_date, next_payment_amount'),

    // 8. Revolving credits (active)
    supabase
      .from('revolving_credits')
      .select('id, name, bank, credit_limit, status')
      .eq('status', 'ACTIVE'),

    // 9. Revolving credit balances
    supabase
      .from('revolving_credit_balances')
      .select('id, used_amount, available_limit'),

    // 10. Unpaid/partial expenses
    supabase
      .from('expenses')
      .select('id, total_amount, paid_amount, supplier_id, suppliers(name), properties(name)')
      .in('status', ['UNPAID', 'PARTIAL'])
      .order('issue_date', { ascending: false }),

    // 11. Daily reports count (pending)
    supabase
      .from('daily_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['SUBMITTED', 'SENT_TO_CO']),

    // 12. Consolidations count (pending)
    supabase
      .from('property_consolidations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'SENT_TO_CO'),

    // 13. Unconfirmed cash collections (SENT — not yet received/accounted at CO)
    supabase
      .from('cash_collections')
      .select('id, amount, collection_date, properties(name)')
      .eq('status', 'SENT')
      .order('collection_date', { ascending: false }),

    // 14. Unaccounted advances (money sent to properties as ADVANCE, not yet ACCOUNTED)
    supabase
      .from('money_received')
      .select('id, amount, sent_date, purpose, properties(name)')
      .eq('purpose', 'ADVANCE')
      .neq('status', 'ACCOUNTED')
      .order('sent_date', { ascending: false }),
  ])

  // Check for critical errors
  const errors = [
    accountsResult.error && `bank_accounts: ${accountsResult.error.message}`,
    balancesResult.error && `bank_account_balances: ${balancesResult.error.message}`,
    coCashResult.error && `co_cash: ${coCashResult.error.message}`,
    coCashBalancesResult.error && `co_cash_balances: ${coCashBalancesResult.error.message}`,
    loansResult.error && `loans: ${loansResult.error.message}`,
    loanBalancesResult.error && `loan_balances: ${loanBalancesResult.error.message}`,
  ].filter(Boolean)

  if (errors.length > 0) {
    return NextResponse.json({ error: 'database_error', details: errors }, { status: 500 })
  }

  // --- Build bank accounts with balances and last transaction ---
  const balanceMap = new Map(
    (balancesResult.data ?? []).map((b) => [b.id, b.current_balance as number])
  )

  // Build last transaction map: account_id -> most recent transaction_date
  const lastTxMap = new Map<string, string>()
  for (const tx of lastTxResult.data ?? []) {
    if (!lastTxMap.has(tx.bank_account_id)) {
      lastTxMap.set(tx.bank_account_id, tx.transaction_date as string)
    }
  }

  const bank_accounts = (accountsResult.data ?? []).map((acct) => ({
    id: acct.id,
    name: acct.name,
    iban: acct.iban,
    bank: acct.bank,
    currency: acct.currency,
    current_balance: balanceMap.get(acct.id) ?? 0,
    last_transaction_date: lastTxMap.get(acct.id) ?? null,
  }))

  // --- CO cash: per register + total ---
  const coCashBalanceMap = new Map(
    (coCashBalancesResult.data ?? []).map((b) => [b.id, b.current_balance as number])
  )
  const co_cash_registers = (coCashResult.data ?? []).map((cc) => ({
    id: cc.id,
    name: cc.name,
    current_balance: coCashBalanceMap.get(cc.id) ?? 0,
  }))
  const totalCoCash = co_cash_registers.reduce((s, c) => s + c.current_balance, 0)
  const co_cash = {
    registers: co_cash_registers,
    total_balance: totalCoCash,
  }

  // --- Property cash registers ---
  const propertyCashRaw = (propertyCashResult.data ?? []) as Array<{
    id: string
    property_id: string
    name: string
    current_balance: number
  }>
  // Fetch property names in one extra query-less lookup via properties already joined? Do a simple map:
  const { data: propsForCash } = await supabase.from('properties').select('id, name')
  const propNameMap = new Map((propsForCash ?? []).map((p) => [p.id, p.name as string]))
  const property_cash_registers = propertyCashRaw.map((pcr) => ({
    id: pcr.id,
    property_id: pcr.property_id,
    name: pcr.name,
    property_name: propNameMap.get(pcr.property_id) ?? '',
    current_balance: Number(pcr.current_balance) || 0,
  }))
  const totalPropertyCash = property_cash_registers.reduce((s, r) => s + r.current_balance, 0)
  const property_cash = {
    registers: property_cash_registers,
    total_balance: totalPropertyCash,
  }

  // --- Loans ---
  const loanBalanceMap = new Map(
    (loanBalancesResult.data ?? []).map((lb) => [lb.id, lb])
  )

  const loans = (loansResult.data ?? []).map((loan) => {
    const bal = loanBalanceMap.get(loan.id)
    const nextPaymentDate = (bal?.next_payment_date as string) ?? null
    const daysUntilPayment = nextPaymentDate
      ? Math.ceil(
          (new Date(nextPaymentDate).getTime() - new Date(today).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null

    return {
      id: loan.id,
      bank: loan.bank,
      original_amount: loan.principal_amount,
      remaining_balance: (bal?.remaining_principal as number) ?? loan.principal_amount,
      monthly_payment: loan.monthly_payment,
      next_payment_date: nextPaymentDate,
      days_until_payment: daysUntilPayment,
      status: loan.status,
    }
  })

  // --- Revolving credits ---
  const revBalanceMap = new Map(
    (revolvingBalancesResult.data ?? []).map((rb) => [rb.id, rb])
  )

  const revolving_credits = (revolvingResult.data ?? []).map((rc) => {
    const bal = revBalanceMap.get(rc.id)
    const usedAmount = (bal?.used_amount as number) ?? 0
    const availableAmount = (bal?.available_limit as number) ?? rc.credit_limit
    const utilizationPct =
      rc.credit_limit > 0 ? (usedAmount / rc.credit_limit) * 100 : 0

    return {
      id: rc.id,
      bank: rc.bank,
      credit_limit: rc.credit_limit,
      used_amount: usedAmount,
      available_amount: availableAmount,
      utilization_pct: Math.round(utilizationPct * 100) / 100,
      status: rc.status,
    }
  })

  // --- Unpaid expenses grouped by supplier ---
  const unpaidRaw = pendingExpensesResult.data ?? []
  const supplierMap = new Map<string, { name: string; remaining: number; count: number }>()
  let unpaidTotal = 0
  for (const exp of unpaidRaw) {
    const remaining = (exp.total_amount as number) - ((exp.paid_amount as number) ?? 0)
    unpaidTotal += remaining
    const supplierName = ((exp.suppliers as unknown as { name: string }) ?? { name: 'Без доставчик' }).name
    const key = exp.supplier_id ?? '__none__'
    const existing = supplierMap.get(key)
    if (existing) {
      existing.remaining += remaining
      existing.count += 1
    } else {
      supplierMap.set(key, { name: supplierName, remaining, count: 1 })
    }
  }
  const unpaid_by_supplier = Array.from(supplierMap.values())
    .sort((a, b) => b.remaining - a.remaining)
  const unpaid_expenses = {
    total: Math.round(unpaidTotal * 100) / 100,
    count: unpaidRaw.length,
    by_supplier: unpaid_by_supplier,
  }

  // --- Pending reports counts ---
  const pending_reports = {
    daily_reports_count: dailyReportsCountResult.count ?? 0,
    consolidations_count: consolidationsCountResult.count ?? 0,
  }

  // --- Unconfirmed collections (cash in properties, awaiting CO confirmation) ---
  const unconfirmed_collections = (unconfirmedCollectionsResult.data ?? []).map((col) => ({
    id: col.id,
    property_name: ((col.properties as unknown as { name: string }) ?? { name: '' }).name,
    amount: col.amount,
    collection_date: col.collection_date,
  }))

  // --- Unaccounted advances ---
  const unaccounted_advances = (unaccountedAdvancesResult.data ?? []).map((adv) => ({
    id: adv.id,
    property_name: ((adv.properties as unknown as { name: string }) ?? { name: '' }).name,
    amount: adv.amount,
    sent_date: adv.sent_date,
    purpose: adv.purpose,
  }))

  // --- Upcoming loan payments (next 7 days) ---
  const upcoming_loan_payments = loans
    .filter(
      (l) =>
        l.next_payment_date !== null &&
        l.days_until_payment !== null &&
        l.days_until_payment >= 0 &&
        l.next_payment_date <= in7Days
    )
    .map((l) => ({
      loan_id: l.id,
      bank: l.bank,
      amount: l.monthly_payment,
      payment_date: l.next_payment_date as string,
      days_until: l.days_until_payment as number,
    }))

  // --- Net cash position ---
  const totalBankBalance = bank_accounts.reduce((s, a) => s + a.current_balance, 0)
  const totalPendingExpenses = unpaid_expenses.total
  const totalUpcomingLoanPayments = upcoming_loan_payments.reduce((s, p) => s + p.amount, 0)

  const net_cash_position =
    totalBankBalance +
    co_cash.total_balance +
    property_cash.total_balance -
    totalPendingExpenses -
    totalUpcomingLoanPayments

  return NextResponse.json({
    bank_accounts,
    co_cash,
    property_cash,
    loans,
    revolving_credits,
    unpaid_expenses,
    pending_reports,
    unconfirmed_collections,
    unaccounted_advances,
    upcoming_loan_payments,
    net_cash_position: Math.round(net_cash_position * 100) / 100,
  })
}
