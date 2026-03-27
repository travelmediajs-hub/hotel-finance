import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/finance/auth'
import { PropertyForm } from '@/components/finance/PropertyForm'

export default async function NewPropertyPage() {
  const user = await requireRole('ADMIN_CO')
  if (!user) redirect('/finance')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PropertyForm />
    </div>
  )
}
