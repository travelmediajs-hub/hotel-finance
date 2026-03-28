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

  // Update consolidation to RETURNED
  const { data, error } = await supabase
    .from('property_consolidations')
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

  // Unlink daily reports and set them back to CONFIRMED
  const { error: reportsError } = await supabase
    .from('daily_reports')
    .update({
      status: 'CONFIRMED',
      consolidation_id: null,
    })
    .eq('consolidation_id', id)

  if (reportsError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
