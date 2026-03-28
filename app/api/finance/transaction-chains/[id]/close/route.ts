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

  const { data: chain, error: fetchError } = await supabase
    .from('transaction_chains')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchError || !chain) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (chain.status !== 'OPEN') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Transaction chain must be OPEN to close' },
      { status: 409 }
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from('transaction_chains')
    .update({
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
