import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { UsaliReportsClient } from '@/components/finance/UsaliReportsClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function UsaliReportsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  if (!isCORole(user.role)) redirect('/finance')

  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('status', 'ACTIVE')
    .order('name')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">USALI Отчети</CardTitle>
        </CardHeader>
        <CardContent>
          <UsaliReportsClient properties={properties ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
