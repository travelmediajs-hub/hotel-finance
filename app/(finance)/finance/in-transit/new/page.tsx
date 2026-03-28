import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/finance/auth'
import { InTransitForm } from '@/components/finance/InTransitForm'

export default async function NewInTransitPage() {
  const user = await requireRole('ADMIN_CO', 'FINANCE_CO')
  if (!user) redirect('/finance')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Ново обръщение</h1>
      <InTransitForm />
    </div>
  )
}
