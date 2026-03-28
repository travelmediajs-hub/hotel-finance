import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { sendConsolidationSchema } from '@/lib/finance/schemas'

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
    .from('property_consolidations')
    .select('*, properties(name)')
    .order('date', { ascending: false })
    .limit(100)

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
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = sendConsolidationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { property_id, date, manager_comment } = parsed.data
  const supabase = await createClient()

  // Get all active departments for the property
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id')
    .eq('property_id', property_id)
    .eq('is_active', true)

  if (deptError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  if (!departments || departments.length === 0) {
    return NextResponse.json(
      { error: 'no_departments', message: 'Няма активни отдели за този обект' },
      { status: 400 }
    )
  }

  // Check that ALL active departments have CONFIRMED daily reports for this date
  const { data: confirmedReports, error: reportsError } = await supabase
    .from('daily_reports')
    .select('id, department_id, total_cash_net, total_pos_net, total_diff')
    .eq('property_id', property_id)
    .eq('date', date)
    .eq('status', 'CONFIRMED')

  if (reportsError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const confirmedDeptIds = new Set((confirmedReports ?? []).map((r) => r.department_id))
  const allConfirmed = departments.every((d) => confirmedDeptIds.has(d.id))

  if (!allConfirmed) {
    return NextResponse.json(
      { error: 'not_all_confirmed', message: 'Не всички отдели са потвърдени за тази дата' },
      { status: 400 }
    )
  }

  // Calculate totals from confirmed reports
  const totalCashNet = confirmedReports!.reduce((sum, r) => sum + (r.total_cash_net ?? 0), 0)
  const totalPosNet = confirmedReports!.reduce((sum, r) => sum + (r.total_pos_net ?? 0), 0)
  const totalDiff = confirmedReports!.reduce((sum, r) => sum + (r.total_diff ?? 0), 0)

  // Sum z_reports total_amount for all confirmed reports
  const reportIds = confirmedReports!.map((r) => r.id)
  const { data: zReports, error: zError } = await supabase
    .from('z_reports')
    .select('cash_amount, pos_amount')
    .in('daily_report_id', reportIds)

  if (zError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const totalZReport = (zReports ?? []).reduce(
    (sum, z) => sum + (z.cash_amount ?? 0) + (z.pos_amount ?? 0),
    0
  )

  // Upsert consolidation (property_id + date is unique)
  const { data: consolidation, error: upsertError } = await supabase
    .from('property_consolidations')
    .upsert(
      {
        property_id,
        date,
        status: 'SENT_TO_CO',
        manager_id: user.id,
        manager_comment: manager_comment ?? null,
        sent_at: new Date().toISOString(),
        total_cash_net: totalCashNet,
        total_pos_net: totalPosNet,
        total_z_report: totalZReport,
        total_diff: totalDiff,
      },
      { onConflict: 'property_id,date' }
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Link daily reports to consolidation and update their status
  const { error: linkError } = await supabase
    .from('daily_reports')
    .update({
      consolidation_id: consolidation.id,
      status: 'SENT_TO_CO',
    })
    .eq('property_id', property_id)
    .eq('date', date)
    .eq('status', 'CONFIRMED')

  if (linkError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(consolidation, { status: 201 })
}
