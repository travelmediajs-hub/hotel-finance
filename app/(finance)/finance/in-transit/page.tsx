import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { InTransitList } from '@/components/finance/InTransitList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import type { InTransitWithCarrier } from '@/components/finance/InTransitList'

export default async function InTransitPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')
  if (!isCORole(user.role)) redirect('/finance')

  const supabase = await createClient()

  const { data: inTransits } = await supabase
    .from('in_transits')
    .select('*, user_profiles(full_name)')
    .order('start_date_time', { ascending: false })
    .limit(200)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Парични трансфери</CardTitle>
          <Link
            href="/finance/in-transit/new"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Нов трансфер
          </Link>
        </CardHeader>
        <CardContent>
          <InTransitList items={(inTransits as InTransitWithCarrier[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
