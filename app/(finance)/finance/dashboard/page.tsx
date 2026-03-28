import { redirect } from 'next/navigation'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { DashboardView } from '@/components/finance/DashboardView'

export default async function DashboardPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/login')
  if (!isCORole(user.role)) redirect('/finance')

  return <DashboardView />
}
