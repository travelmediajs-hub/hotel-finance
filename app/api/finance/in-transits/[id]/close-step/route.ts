import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { closeInTransitStepSchema } from '@/lib/finance/schemas'

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

  const body = await request.json()
  const parsed = closeInTransitStepSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: inTransit, error: fetchError } = await supabase
    .from('in_transits')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !inTransit) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (inTransit.status !== 'OPEN' && inTransit.status !== 'PARTIALLY_CLOSED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'In-transit must be OPEN or PARTIALLY_CLOSED' },
      { status: 409 }
    )
  }

  const newRemaining = Number(inTransit.remaining_amount) - parsed.data.amount

  if (newRemaining < 0) {
    return NextResponse.json(
      { error: 'amount_exceeds_remaining' },
      { status: 400 }
    )
  }

  const newStatus = newRemaining === 0 ? 'CLOSED' : 'PARTIALLY_CLOSED'
  const closedAt = newRemaining === 0 ? new Date().toISOString() : null

  const updatePayload: Record<string, unknown> = {
    remaining_amount: newRemaining,
    status: newStatus,
  }
  if (closedAt) {
    updatePayload.closed_at = closedAt
  }

  const { data: updated, error: updateError } = await supabase
    .from('in_transits')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
