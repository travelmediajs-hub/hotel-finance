import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { DailyReportList } from '@/components/finance/DailyReportList'
import type { ReportWithJoins } from '@/components/finance/DailyReportList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export default async function DailyReportsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  let query = supabase
    .from('daily_reports')
    .select('*, departments!inner(name), properties!inner(name)')
    .order('date', { ascending: false })
    .limit(100)

  if (user.role === 'DEPT_HEAD') {
    query = query.eq('created_by_id', user.id)
  }

  const { data: reports } = await query

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Дневни отчети</CardTitle>
          {user.role === 'DEPT_HEAD' && (
            <Link
              href="/finance/daily-reports/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Нов отчет
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <DailyReportList reports={(reports as ReportWithJoins[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
