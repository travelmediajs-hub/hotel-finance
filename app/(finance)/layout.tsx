import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getFinanceUser, SIMULATE_PROPERTY_COOKIE } from '@/lib/finance/auth'
import { createClient } from '@/lib/supabase/server'
import { FinanceSidebar } from '@/components/finance/FinanceSidebar'

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/login')

  // For ADMIN_CO, load all active properties so the role simulator can pick one.
  let allProperties: { id: string; name: string }[] = []
  let simulatedPropertyId: string | null = null
  if (user.realRole === 'ADMIN_CO') {
    const supabase = await createClient()
    const { data } = await supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name')
    allProperties = data ?? []
    const cookieStore = await cookies()
    simulatedPropertyId = cookieStore.get(SIMULATE_PROPERTY_COOKIE)?.value ?? null
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <FinanceSidebar
        userFullName={user.fullName}
        userRole={user.role}
        realRole={user.realRole}
        isSimulating={user.isSimulating}
        allProperties={allProperties}
        simulatedPropertyId={simulatedPropertyId}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
