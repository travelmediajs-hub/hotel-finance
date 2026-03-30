import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { InTransitForm } from '@/components/finance/InTransitForm'

export default async function NewInTransitPage() {
  const user = await requireRole('ADMIN_CO', 'FINANCE_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()

  const [
    { data: bankAccounts },
    { data: coCash },
    { data: properties },
    { data: users },
  ] = await Promise.all([
    supabase.from('bank_accounts').select('id, name, iban').eq('status', 'ACTIVE').order('name'),
    supabase.from('co_cash').select('id, name').order('name'),
    supabase.from('properties').select('id, name').eq('status', 'ACTIVE').order('name'),
    supabase.from('user_profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Нов паричен трансфер</h1>
      <InTransitForm
        bankAccounts={(bankAccounts ?? []) as { id: string; name: string; iban: string }[]}
        coCash={(coCash ?? []) as { id: string; name: string }[]}
        properties={(properties ?? []) as { id: string; name: string }[]}
        users={(users ?? []) as { id: string; full_name: string }[]}
      />
    </div>
  )
}
