import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { IncomeForm } from '@/components/finance/IncomeForm'

export default async function NewIncomePage() {
  const user = await requireRole('ADMIN_CO', 'FINANCE_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()

  const [
    { data: properties },
    { data: bankAccounts },
    { data: loans },
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase
      .from('bank_accounts')
      .select('id, name, iban')
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase
      .from('loans')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name'),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Нов приходен запис</h1>
      <IncomeForm
        properties={(properties ?? []) as { id: string; name: string }[]}
        bankAccounts={(bankAccounts ?? []) as { id: string; name: string; iban: string }[]}
        loans={(loans ?? []) as { id: string; name: string }[]}
      />
    </div>
  )
}
