import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { SupplierList } from '@/components/finance/SupplierList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SuppliersPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, eik, vat_number, contact_person, phone, email, address, iban, notes, is_active')
    .order('name')

  const canManage = user.role === 'ADMIN_CO' || user.role === 'FINANCE_CO' || user.role === 'MANAGER'

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Доставчици</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierList suppliers={suppliers ?? []} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  )
}
