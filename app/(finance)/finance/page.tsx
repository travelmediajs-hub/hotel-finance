import { redirect } from 'next/navigation'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

export default async function FinancePage() {
  const user = await getFinanceUser()
  if (!user) redirect('/login')

  if (isCORole(user.role)) {
    redirect('/finance/properties')
  }
  redirect('/finance/daily-reports')
}
