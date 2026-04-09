import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

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

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (!['SUBMITTED', 'APPROVED'].includes(report.status)) {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът не може да бъде върнат в този статус' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update({
      status: 'RETURNED',
      co_comment: body.comment.trim(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}
