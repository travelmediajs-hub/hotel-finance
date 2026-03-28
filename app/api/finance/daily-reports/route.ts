import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { createDailyReportSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const propertyId = searchParams.get('property_id')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')

  if (!propertyId) {
    return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
  }

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(propertyId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let query = supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*, departments(id, name))')
    .eq('property_id', propertyId)
    .order('date', { ascending: false })
    .limit(60)

  if (fromDate) query = query.gte('date', fromDate)
  if (toDate) query = query.lte('date', toDate)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN_CO' && user.role !== 'DEPT_HEAD') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createDailyReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { property_id, date } = parsed.data
  const supabase = await createClient()

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(property_id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('property_id', property_id)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', message: 'Вече съществува отчет за този обект и дата' },
      { status: 409 }
    )
  }

  const { data: report, error: reportError } = await supabase
    .from('daily_reports')
    .insert({
      property_id,
      date,
      created_by_id: user.id,
      status: 'DRAFT',
      total_cash_net: 0,
      total_pos_net: 0,
      cash_diff: 0,
      pos_diff: 0,
      total_diff: 0,
    })
    .select()
    .single()

  if (reportError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const { data: departments } = await supabase
    .from('departments')
    .select('id')
    .eq('property_id', property_id)
    .eq('status', 'ACTIVE')

  if (departments && departments.length > 0) {
    const { error: linesError } = await supabase
      .from('daily_report_lines')
      .insert(
        departments.map((d) => ({
          daily_report_id: report.id,
          department_id: d.id,
        }))
      )

    if (linesError) {
      await supabase.from('daily_reports').delete().eq('id', report.id)
      return NextResponse.json({ error: 'database_error' }, { status: 500 })
    }
  }

  return NextResponse.json(report, { status: 201 })
}
