import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { updateLineSchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = updateLineSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('id, property_id, status')
    .eq('id', id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (report.status !== 'DRAFT' && report.status !== 'RETURNED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът не може да се редактира в този статус' },
      { status: 400 }
    )
  }

  if (user.role === 'DEPT_HEAD') {
    const { data: access } = await supabase
      .from('user_department_access')
      .select('department_id')
      .eq('user_id', user.id)

    const allowedDepts = (access ?? []).map((a) => a.department_id)
    if (!allowedDepts.includes(parsed.data.department_id)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const { department_id, ...updateFields } = parsed.data

  const { data: line, error } = await supabase
    .from('daily_report_lines')
    .update({ ...updateFields, filled_by_id: user.id })
    .eq('daily_report_id', id)
    .eq('department_id', department_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Recalculate report totals
  const { data: allLines } = await supabase
    .from('daily_report_lines')
    .select('cash_net, pos_net, cash_diff, pos_diff, total_diff')
    .eq('daily_report_id', id)

  if (allLines) {
    const totalCashNet = allLines.reduce((s, l) => s + Number(l.cash_net), 0)
    const totalPosNet = allLines.reduce((s, l) => s + Number(l.pos_net), 0)
    const cashDiff = allLines.reduce((s, l) => s + Number(l.cash_diff), 0)
    const posDiff = allLines.reduce((s, l) => s + Number(l.pos_diff), 0)
    const totalDiff = allLines.reduce((s, l) => s + Number(l.total_diff), 0)

    await supabase
      .from('daily_reports')
      .update({
        total_cash_net: totalCashNet,
        total_pos_net: totalPosNet,
        cash_diff: cashDiff,
        pos_diff: posDiff,
        total_diff: totalDiff,
      })
      .eq('id', id)
  }

  return NextResponse.json(line)
}
