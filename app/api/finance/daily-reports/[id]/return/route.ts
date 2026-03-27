import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Parse body — comment is mandatory
  let body: { comment?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'validation_error', message: 'Тялото на заявката е задължително' },
      { status: 400 }
    )
  }

  if (!body.comment || body.comment.trim() === '') {
    return NextResponse.json(
      { error: 'validation_error', message: 'Коментарът е задължителен при връщане' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Fetch the report
  const { data: report, error: fetchError } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const isManager = user.role === 'MANAGER'
  const isCO = isCORole(user.role)

  // MANAGER can return SUBMITTED reports
  if (isManager && report.status === 'SUBMITTED') {
    const { data, error } = await supabase
      .from('daily_reports')
      .update({
        status: 'RETURNED',
        manager_comment: body.comment.trim(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'database_error' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // CO can return SENT_TO_CO reports
  if (isCO && report.status === 'SENT_TO_CO') {
    const { data, error } = await supabase
      .from('daily_reports')
      .update({
        status: 'RETURNED',
        co_comment: body.comment.trim(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'database_error' }, { status: 500 })
    }

    return NextResponse.json(data)
  }

  // If we get here, the user doesn't have permission for this action in this status
  return NextResponse.json(
    { error: 'forbidden', message: 'Нямате право да върнете рапорт в този статус' },
    { status: 403 }
  )
}
