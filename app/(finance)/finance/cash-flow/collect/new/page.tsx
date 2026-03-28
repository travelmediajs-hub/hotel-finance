import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { CashCollectionForm } from '@/components/finance/CashCollectionForm'

export default async function NewCashCollectionPage() {
  const user = await requireRole('ADMIN_CO', 'FINANCE_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('status', 'ACTIVE')
    .order('name')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Ново събиране на каса</h1>
      <CashCollectionForm properties={(properties ?? []) as { id: string; name: string }[]} />
    </div>
  )
}
