import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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

  if (report.status !== 'SUBMITTED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Рапортът трябва да е в статус ПОДАДЕН' },
      { status: 400 }
    )
  }

  // Optional manager_comment from body
  let managerComment: string | undefined
  try {
    const body = await request.json()
    managerComment = body.manager_comment
  } catch {
    // No body or invalid JSON — that's fine, comment is optional
  }

  const updateData: Record<string, unknown> = {
    status: 'CONFIRMED',
    confirmed_by_id: user.id,
    confirmed_at: new Date().toISOString(),
  }
  if (managerComment !== undefined) {
    updateData.manager_comment = managerComment
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
