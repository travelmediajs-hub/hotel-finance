import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.role !== 'DEPT_HEAD') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  // Fetch the report
  const { data: report, error: fetchError } = await supabase
    .from('daily_reports')
    .select('*, z_reports(*)')
    .eq('id', id)
    .single()

  if (fetchError || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Only the creator can submit
  if (report.created_by_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Must be DRAFT or RETURNED
  if (report.status !== 'DRAFT' && report.status !== 'RETURNED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Рапортът трябва да е в статус ЧЕРНОВА или ВЪРНАТ' },
      { status: 400 }
    )
  }

  // z_report attachment_url must exist
  const zReport = Array.isArray(report.z_reports) ? report.z_reports[0] : report.z_reports
  if (!zReport?.attachment_url) {
    return NextResponse.json(
      { error: 'validation_error', message: 'Z-отчетът трябва да има прикачен файл' },
      { status: 400 }
    )
  }

  // diff_explanation required if total_diff != 0
  if (Number(report.total_diff) !== 0 && !report.diff_explanation) {
    return NextResponse.json(
      { error: 'validation_error', message: 'Обяснение за разликата е задължително когато има разлика' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
