import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Fetch consolidation with property info
  const { data: consolidation, error } = await supabase
    .from('property_consolidations')
    .select('*, properties(id, name)')
    .eq('id', id)
    .single()

  if (error || !consolidation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Fetch related daily reports for the same property + date
  const { data: dailyReports, error: reportsError } = await supabase
    .from('daily_reports')
    .select(`
      *,
      departments(name),
      daily_report_lines(*),
      pos_entries(*),
      z_reports(*)
    `)
    .eq('property_id', consolidation.property_id)
    .eq('date', consolidation.date)

  if (reportsError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json({
    ...consolidation,
    daily_reports: dailyReports,
  })
}
