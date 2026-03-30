import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
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

  // Only creator (MANAGER) or ADMIN_CO can submit
  if (expense.created_by_id !== user.id && user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Must be in DRAFT or RETURNED status
  if (expense.status !== 'DRAFT' && expense.status !== 'RETURNED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Разходът трябва да е в статус ЧЕРНОВА или ВЪРНАТ' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'SENT_TO_CO',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
