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

  if (user.role !== 'MANAGER' && !isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const receivedInCash: string | undefined = body?.received_in_cash

  if (!receivedInCash || receivedInCash.trim().length === 0) {
    return NextResponse.json(
      { error: 'validation_error', message: 'received_in_cash е задължително поле' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: record, error: fetchError } = await supabase
    .from('money_received')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (record.status !== 'SENT') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Само записи в статус SENT могат да бъдат потвърдени' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('money_received')
    .update({
      status: 'RECEIVED',
      received_by_id: user.id,
      received_at: new Date().toISOString(),
      received_in_cash: receivedInCash,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
