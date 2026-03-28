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

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  // Fetch the consolidation
  const { data: consolidation, error: fetchError } = await supabase
    .from('property_consolidations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !consolidation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (consolidation.status !== 'SENT_TO_CO') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Консолидацията трябва да е в статус ИЗПРАТЕНА КЪМ ЦО' },
      { status: 400 }
    )
  }

  // Optional co_comment from body
  let coComment: string | undefined
  try {
    const body = await request.json()
    coComment = body.co_comment
  } catch {
    // No body or invalid JSON — that's fine, comment is optional
  }

  const updateData: Record<string, unknown> = {
    status: 'APPROVED',
    approved_by_id: user.id,
    approved_at: new Date().toISOString(),
  }
  if (coComment !== undefined) {
    updateData.co_comment = coComment
  }

  const { data, error } = await supabase
    .from('property_consolidations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Also approve all linked daily reports
  const { error: reportsError } = await supabase
    .from('daily_reports')
    .update({
      status: 'APPROVED',
      approved_by_id: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('consolidation_id', id)

  if (reportsError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
