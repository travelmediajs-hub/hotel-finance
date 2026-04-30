import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { IncomeForm } from '@/components/finance/IncomeForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditIncomePage({ params }: Props) {
  const user = await requireRole('ADMIN_CO', 'FINANCE_CO')
  if (!user) redirect('/finance/income')

  const { id } = await params
  const supabase = await createClient()

  const { data: entry } = await supabase
    .from('income_entries')
    .select('*')
    .eq('id', id)
    .single()

  if (!entry) notFound()

  const editable = ['ENTERED', 'CONFIRMED', 'ADVANCE'].includes(entry.status)
  const sameDay =
    new Date(entry.created_at).toDateString() === new Date().toDateString()
  if (!editable || !sameDay) redirect(`/finance/income/${id}`)

  const [
    { data: properties },
    { data: bankAccounts },
    { data: loans },
    { data: accounts },
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
    supabase
      .from('usali_accounts')
      .select('id, code, name, level, account_type, parent_id')
      .eq('is_active', true)
      .eq('account_type', 'REVENUE')
      .order('sort_order'),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Редактиране на приход</h1>
      <IncomeForm
        properties={(properties ?? []) as { id: string; name: string }[]}
        bankAccounts={(bankAccounts ?? []) as { id: string; name: string; iban: string }[]}
        loans={(loans ?? []) as { id: string; name: string }[]}
        accounts={(accounts ?? []) as Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>}
        entry={entry}
      />
    </div>
  )
}
