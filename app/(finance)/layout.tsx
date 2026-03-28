import { redirect } from 'next/navigation'
import { getFinanceUser } from '@/lib/finance/auth'
import { FinanceSidebar } from '@/components/finance/FinanceSidebar'

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <FinanceSidebar
        userFullName={user.fullName}
        userRole={user.role}
        realRole={user.realRole}
        isSimulating={user.isSimulating}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
