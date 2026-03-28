import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { ConsolidationList } from '@/components/finance/ConsolidationList'
import type { ConsolidationWithJoins } from '@/components/finance/ConsolidationList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export default async function ConsolidationsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  const { data: consolidations } = await supabase
    .from('property_consolidations')
    .select('*, properties!inner(name)')
    .order('date', { ascending: false })
    .limit(100)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Консолидации</CardTitle>
          {(user.role === 'MANAGER' || user.role === 'ADMIN_CO') && (
            <Link
              href="/finance/consolidations/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Нова консолидация
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <ConsolidationList consolidations={(consolidations as ConsolidationWithJoins[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
