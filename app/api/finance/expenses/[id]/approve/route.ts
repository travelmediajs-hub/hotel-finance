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

  // Fetch the expense
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !expense) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (expense.status !== 'SENT_TO_CO') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Разходът трябва да е в статус ИЗПРАТЕН КЪМ ЦО' },
      { status: 400 }
    )
  }

  // Optional co_comment from body
  let coComment: string | undefined
  try {
    const body = await request.json()
    coComment = body.co_comment
  } catch {
    // No body or invalid JSON — comment is optional
  }

  const updateData: Record<string, unknown> = {
    status: 'APPROVED',
    approved_by_id: user.id,
    updated_at: new Date().toISOString(),
  }
  if (coComment !== undefined) {
    updateData.co_comment = coComment
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
