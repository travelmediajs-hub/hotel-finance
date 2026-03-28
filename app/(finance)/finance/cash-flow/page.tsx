import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { CashCollectionList } from '@/components/finance/CashCollectionList'
import { MoneyReceivedList } from '@/components/finance/MoneyReceivedList'
import type { CashCollectionWithJoins } from '@/components/finance/CashCollectionList'
import type { MoneyReceivedWithJoins } from '@/components/finance/MoneyReceivedList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'

export default async function CashFlowPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const isCO = isCORole(user.role)

  const { data: collections } = await supabase
    .from('cash_collections')
    .select('*, properties(name), collected_by:user_profiles!collected_by_id(full_name)')
    .order('collection_date', { ascending: false })
    .limit(200)

  const { data: moneyReceived } = await supabase
    .from('money_received')
    .select('*, properties(name)')
    .order('sent_date', { ascending: false })
    .limit(200)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Tabs defaultValue="collections">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Касов поток</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="collections">Събиране от обекти</TabsTrigger>
              <TabsTrigger value="sent">Изпратени към обекти</TabsTrigger>
            </TabsList>

            <TabsContent value="collections" className="mt-0">
              <div className="flex justify-end mb-4">
                {isCO && (
                  <Link
                    href="/finance/cash-flow/collect/new"
                    className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ново събиране
                  </Link>
                )}
              </div>
              <CashCollectionList
                collections={(collections as CashCollectionWithJoins[]) ?? []}
              />
            </TabsContent>

            <TabsContent value="sent" className="mt-0">
              <div className="flex justify-end mb-4">
                {isCO && (
                  <Link
                    href="/finance/cash-flow/send/new"
                    className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Нови пари към обект
                  </Link>
                )}
              </div>
              <MoneyReceivedList
                records={(moneyReceived as MoneyReceivedWithJoins[]) ?? []}
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  )
}
