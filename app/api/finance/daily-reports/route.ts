import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { saveDailyReportSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const propertyId = searchParams.get('property_id')
  const date = searchParams.get('date')
  const status = searchParams.get('status')

  let query = supabase
    .from('daily_reports')
    .select('*, departments(name), properties(name)')
    .order('date', { ascending: false })
    .limit(100)

  // DEPT_HEAD sees only reports they created
  if (user.role === 'DEPT_HEAD') {
    query = query.eq('created_by_id', user.id)
  }

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }
  if (date) {
    query = query.eq('date', date)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = saveDailyReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { department_id, property_id, date, lines, pos_entries, z_report, diff_explanation } =
    parsed.data

  const supabase = await createClient()

  // Check for duplicate report (same department + date)
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('department_id', department_id)
    .eq('date', date)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', message: 'Вече съществува отчет за този отдел и дата' },
      { status: 409 }
    )
  }

  // Calculate totals
  const totalCashNet = lines.reduce(
    (sum, l) => sum + (l.cash_income - l.cash_return),
    0
  )
  const totalPOSNet = pos_entries.reduce(
    (sum, e) => sum + (e.amount - e.return_amount),
    0
  )
  const cashDiff = totalCashNet - z_report.cash_amount
  const posDiff = totalPOSNet - z_report.pos_amount
  const totalDiff = cashDiff + posDiff

  // Insert report
  const { data: report, error: reportError } = await supabase
    .from('daily_reports')
    .insert({
      department_id,
      property_id,
      date,
      created_by_id: user.id,
      status: 'DRAFT',
      total_cash_net: totalCashNet,
      total_pos_net: totalPOSNet,
      cash_diff: cashDiff,
      pos_diff: posDiff,
      total_diff: totalDiff,
      diff_explanation: diff_explanation ?? null,
    })
    .select()
    .single()

  if (reportError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Insert child records in parallel
  const reportId = report.id

  const [linesResult, posResult, zResult] = await Promise.all([
    // Insert report lines
    supabase.from('daily_report_lines').insert(
      lines.map((l) => ({
        daily_report_id: reportId,
        department_id: l.department_id,
        cash_income: l.cash_income,
        cash_return: l.cash_return,
      }))
    ),
    // Insert POS entries
    pos_entries.length > 0
      ? supabase.from('pos_entries').insert(
          pos_entries.map((e) => ({
            daily_report_id: reportId,
            pos_terminal_id: e.pos_terminal_id,
            amount: e.amount,
            return_amount: e.return_amount,
          }))
        )
      : { error: null },
    // Insert Z-report
    supabase.from('z_reports').insert({
      daily_report_id: reportId,
      cash_amount: z_report.cash_amount,
      pos_amount: z_report.pos_amount,
      attachment_url: z_report.attachment_url,
      additional_files: z_report.additional_files ?? [],
    }),
  ])

  if (linesResult.error || posResult.error || zResult.error) {
    // Clean up the parent report if child inserts fail
    await supabase.from('daily_reports').delete().eq('id', reportId)
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(report, { status: 201 })
}
