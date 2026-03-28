import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.role !== 'MANAGER' && !isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: collection, error: fetchError } = await supabase
    .from('cash_collections')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !collection) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (collection.status !== 'SENT') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Само записи в статус SENT могат да бъдат потвърдени' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('cash_collections')
    .update({
      status: 'RECEIVED',
      confirmed_by_id: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
