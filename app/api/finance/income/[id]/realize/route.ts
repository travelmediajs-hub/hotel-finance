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

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: entry, error: fetchError } = await supabase
    .from('income_entries')
    .select('id, status, type')
    .eq('id', id)
    .single()

  if (fetchError || !entry) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (entry.status !== 'ADVANCE' || entry.type !== 'INC_ADV') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Само авансови записи в статус ADVANCE могат да бъдат реализирани' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('income_entries')
    .update({ status: 'REALIZED', is_advance_realized: true })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
