import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { CashRegisterView } from '@/components/finance/CashRegisterView'

export default async function CashRegisterPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Get accessible properties
  const allowedIds = await getUserPropertyIds(user)
  let propertiesQuery = supabase.from('properties').select('id, name').eq('status', 'ACTIVE').order('name')
  if (allowedIds !== null) {
    if (allowedIds.length === 0) {
      return <div className="p-6 text-muted-foreground">Нямате достъп до обекти</div>
    }
    propertiesQuery = propertiesQuery.in('id', allowedIds)
  }
  const { data: properties } = await propertiesQuery

  // Get all cash balances
  let balancesQuery = supabase.from('property_cash_balances').select('*')
  if (allowedIds !== null) {
    balancesQuery = balancesQuery.in('property_id', allowedIds)
  }
  const { data: balances } = await balancesQuery

  const canEdit = user.role === 'ADMIN_CO' || user.role === 'FINANCE_CO'
  const singleProperty = allowedIds !== null && allowedIds.length === 1

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <CashRegisterView
        properties={properties ?? []}
        balances={balances ?? []}
        canEdit={canEdit}
        defaultPropertyId={singleProperty ? allowedIds![0] : undefined}
      />
    </div>
  )
}
