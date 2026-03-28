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

  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (report.status !== 'SUBMITTED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът трябва да е в статус ИЗПРАТЕН' },
      { status: 400 }
    )
  }

  let coComment: string | undefined
  try {
    const body = await request.json()
    coComment = body.co_comment
  } catch {
    // optional
  }

  const updateData: Record<string, unknown> = {
    status: 'APPROVED',
    approved_by_id: user.id,
    approved_at: new Date().toISOString(),
  }
  if (coComment) updateData.co_comment = coComment

  const { data, error } = await supabase
    .from('daily_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}
