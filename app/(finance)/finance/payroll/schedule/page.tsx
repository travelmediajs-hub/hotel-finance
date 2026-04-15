import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { ScheduleView } from '@/components/finance/ScheduleView'

export default async function SchedulePage() {
  const user = await getFinanceUser()
  if (!user) redirect('/auth/login')
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) redirect('/finance/dashboard')

  const supabase = await createClient()

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

  const defaultPropertyId = properties[0]?.id ?? null

  return (
    <div className="p-4 max-w-[1600px] mx-auto">
      <ScheduleView
        properties={properties}
        defaultPropertyId={defaultPropertyId}
      />
    </div>
  )
}
