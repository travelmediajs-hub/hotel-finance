import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  getFinanceUser,
  isCORole,
  SIMULATE_PROPERTY_COOKIE,
  ACTIVE_PROPERTY_COOKIE,
} from '@/lib/finance/auth'
import { createClient } from '@/lib/supabase/server'
import { FinanceSidebar } from '@/components/finance/FinanceSidebar'
import { PropertyBanner } from '@/components/finance/PropertyBanner'

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const supabase = await createClient()

  // For ADMIN_CO, load all active properties so the role simulator can pick one.
  let allProperties: { id: string; name: string }[] = []
  let simulatedPropertyId: string | null = null
  if (user.realRole === 'ADMIN_CO') {
    const { data } = await supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name')
    allProperties = data ?? []
    simulatedPropertyId = cookieStore.get(SIMULATE_PROPERTY_COOKIE)?.value ?? null
  }

  // Load the accessible properties + active selection for the banner.
  // We key off the EFFECTIVE role (user.role) so ADMIN_CO simulating a
  // MANAGER/DEPT_HEAD still sees the banner, scoped to the simulated
  // property. Real CO users (without simulation) skip the banner since
  // they legitimately see all properties at once.
  let accessibleProperties: { id: string; name: string }[] = []
  let activePropertyId: string | null = null
  const showBanner = !isCORole(user.role)

  if (showBanner) {
    if (user.isSimulating) {
      // ADMIN_CO pretending to be a non-CO role → reuse the full property
      // list they already have access to, and use the simulation cookie
      // as the "active" selection.
      accessibleProperties = allProperties
      activePropertyId = simulatedPropertyId
    } else {
      // Real non-CO user — scope to user_property_access.
      const { data: access } = await supabase
        .from('user_property_access')
        .select('property_id')
        .eq('user_id', user.id)
      const accessIds = (access ?? []).map(a => a.property_id)
      if (accessIds.length > 0) {
        const { data: props } = await supabase
          .from('properties')
          .select('id, name')
          .in('id', accessIds)
          .eq('status', 'ACTIVE')
          .order('name')
        accessibleProperties = props ?? []
      }
      const cookieValue = cookieStore.get(ACTIVE_PROPERTY_COOKIE)?.value ?? null
      if (cookieValue && accessibleProperties.some(p => p.id === cookieValue)) {
        activePropertyId = cookieValue
      } else if (accessibleProperties.length > 0) {
        activePropertyId = accessibleProperties[0].id
      }
    }
  }

  // Simulating admins switch property via the simulation API (sidebar),
  // so the banner itself should be read-only in that mode.
  const bannerCanSwitch = !user.isSimulating && accessibleProperties.length > 1

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <FinanceSidebar
        userFullName={user.fullName}
        userRole={user.role}
        realRole={user.realRole}
        isSimulating={user.isSimulating}
        allProperties={allProperties}
        simulatedPropertyId={simulatedPropertyId}
        accessibleProperties={accessibleProperties}
        activePropertyId={activePropertyId}
      />
      <main className="flex-1 overflow-auto">
        {showBanner && accessibleProperties.length > 0 && (
          <PropertyBanner
            properties={accessibleProperties}
            activePropertyId={activePropertyId}
            canSwitch={bannerCanSwitch}
          />
        )}
        {children}
      </main>
    </div>
  )
}
