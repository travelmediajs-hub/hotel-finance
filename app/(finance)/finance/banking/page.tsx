import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { BankingTabs } from '@/components/finance/BankingTabs'
import type {
  BankAccount,
  BankAccountBalance,
  BankTransaction,
  Loan,
  LoanBalance,
  RevolvingCredit,
  RevolvingCreditBalance,
  COCash,
  COCashBalance,
  Property,
} from '@/types/finance'

export default async function BankingPage() {
  const user = await getFinanceUser()
  if (!user || !isCORole(user.role)) redirect('/finance')

  const supabase = await createClient()

  const [
    { data: accounts },
    { data: balances },
    { data: transactions },
    { data: loans },
    { data: loanBalances },
    { data: revolvingCredits },
    { data: revolvingBalances },
    { data: coCash },
    { data: coCashBalances },
    { data: properties },
  ] = await Promise.all([
    supabase.from('bank_accounts').select('*').order('name'),
    supabase.from('bank_account_balances').select('*'),
    supabase
      .from('bank_transactions')
      .select('*, bank_accounts(name), properties(name)')
      .order('transaction_date', { ascending: false })
      .limit(200),
    supabase.from('loans').select('*, bank_accounts(name)').order('name'),
    supabase.from('loan_balances').select('*'),
    supabase.from('revolving_credits').select('*, bank_accounts(name)').order('name'),
    supabase.from('revolving_credit_balances').select('*'),
    supabase.from('co_cash').select('*').order('name'),
    supabase.from('co_cash_balances').select('*'),
    supabase.from('properties').select('id, name').order('name'),
  ])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <BankingTabs
        accounts={(accounts as BankAccount[]) ?? []}
        balances={(balances as BankAccountBalance[]) ?? []}
        transactions={(transactions as (BankTransaction & { bank_accounts: { name: string }; properties: { name: string } | null })[]) ?? []}
        loans={(loans as (Loan & { bank_accounts: { name: string } })[]) ?? []}
        loanBalances={(loanBalances as LoanBalance[]) ?? []}
        revolvingCredits={(revolvingCredits as (RevolvingCredit & { bank_accounts: { name: string } })[]) ?? []}
        revolvingBalances={(revolvingBalances as RevolvingCreditBalance[]) ?? []}
        coCash={(coCash as COCash[]) ?? []}
        coCashBalances={(coCashBalances as COCashBalance[]) ?? []}
        properties={(properties as Pick<Property, 'id' | 'name'>[]) ?? []}
      />
    </div>
  )
}
