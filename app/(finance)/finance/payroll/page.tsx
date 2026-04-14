import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { PayrollView } from '@/components/finance/PayrollView'

export default async function PayrollPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/auth/login')
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) redirect('/finance/dashboard')

  const supabase = await createClient()

  // Properties
  let properties: Array<{ id: string; name: string }> = []
  if (isCORole(user.role)) {
    const { data } = await supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name')
    properties = data ?? []
  } else {
    const propIds = await getUserPropertyIds(user)
    if (propIds && propIds.length > 0) {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', propIds)
        .order('name')
      properties = data ?? []
    }
  }

  // USALI departments for employee classification
  const { data: usaliDepts } = await supabase
    .from('usali_department_templates')
    .select('id, code, name')
    .order('sort_order')

  const defaultPropertyId = properties[0]?.id ?? null

  return (
    <div className="p-4 max-w-[1600px] mx-auto">
      <PayrollView
        properties={properties}
        usaliDepartments={usaliDepts ?? []}
        defaultPropertyId={defaultPropertyId}
        userRole={user.role}
      />
    </div>
  )
}
