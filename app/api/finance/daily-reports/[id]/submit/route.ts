import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*)')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (report.status !== 'DRAFT' && report.status !== 'RETURNED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът трябва да е в статус ЧЕРНОВА или ВЪРНАТ' },
      { status: 400 }
    )
  }

  const lines: any[] = report.daily_report_lines ?? []

  const hasData = lines.some(
    (l: any) => Number(l.cash_income) > 0 || Number(l.pos_income) > 0
  )
  if (!hasData) {
    return NextResponse.json(
      { error: 'validation_error', message: 'Поне един отдел трябва да има въведени данни' },
      { status: 400 }
    )
  }

  // Check Z-report attachments for departments with fiscal devices
  const { data: departments } = await supabase
    .from('departments')
    .select('id, fiscal_device_id')
    .eq('property_id', report.property_id)
    .eq('status', 'ACTIVE')

  const deptsWithFiscal = new Set(
    (departments ?? []).filter((d) => d.fiscal_device_id).map((d) => d.id)
  )

  for (const line of lines) {
    const hasFiscal = deptsWithFiscal.has(line.department_id)
    const hasActivity = Number(line.cash_income) > 0 || Number(line.pos_income) > 0
    if (hasFiscal && hasActivity && !line.z_attachment_url) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Z-отчет файл е задължителен за отдели с фискално устройство',
        },
        { status: 400 }
      )
    }
  }

  // Parse body for optional fields
  let bodyData: { diff_explanation?: string; general_attachment_url?: string } = {}
  try {
    bodyData = await request.json()
  } catch {
    // no body is fine
  }

  // diff_explanation required if total_diff != 0
  if (Number(report.total_diff) !== 0 && !report.diff_explanation && !bodyData.diff_explanation) {
    return NextResponse.json(
      { error: 'validation_error', message: 'Обяснение за разликата е задължително' },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
  }
  if (bodyData.general_attachment_url) {
    updateData.general_attachment_url = bodyData.general_attachment_url
  }
  if (bodyData.diff_explanation) {
    updateData.diff_explanation = bodyData.diff_explanation
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}
