import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { InTransitList } from '@/components/finance/InTransitList'
import { ChainList } from '@/components/finance/ChainList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import type { InTransitWithCarrier } from '@/components/finance/InTransitList'
import type { ChainWithStepCount } from '@/components/finance/ChainList'

export default async function InTransitPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')
  if (!isCORole(user.role)) redirect('/finance')

  const supabase = await createClient()

  const [
    { data: inTransits },
    { data: chains },
  ] = await Promise.all([
    supabase
      .from('in_transits')
      .select('*, user_profiles(full_name)')
      .order('start_date_time', { ascending: false })
      .limit(200),
    supabase
      .from('transaction_chains')
      .select('id, name, chain_date, description, status, transaction_chain_steps(count)')
      .order('chain_date', { ascending: false })
      .limit(200),
  ])

  const chainsWithCount: ChainWithStepCount[] = (chains ?? []).map((c: {
    id: string
    name: string
    chain_date: string
    description: string | null
    status: string
    transaction_chain_steps: { count: number }[] | { count: number }
  }) => ({
    id: c.id,
    name: c.name,
    chain_date: c.chain_date,
    description: c.description,
    status: c.status as 'OPEN' | 'CLOSED',
    step_count: Array.isArray(c.transaction_chain_steps)
      ? (c.transaction_chain_steps[0] as { count: number } | undefined)?.count ?? 0
      : (c.transaction_chain_steps as { count: number }).count ?? 0,
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Tabs defaultValue="in-transits">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="in-transits">Обръщения</TabsTrigger>
            <TabsTrigger value="chains">Вериги</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="in-transits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Обръщения</CardTitle>
              <Link
                href="/finance/in-transit/new"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ново обръщение
              </Link>
            </CardHeader>
            <CardContent>
              <InTransitList items={(inTransits as InTransitWithCarrier[]) ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chains">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Вериги</CardTitle>
              <Link
                href="/finance/in-transit/chain/new"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Нова верига
              </Link>
            </CardHeader>
            <CardContent>
              <ChainList chains={chainsWithCount} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
