import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createInTransitSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')

  let query = supabase
    .from('in_transits')
    .select(`
      *,
      carried_by:user_profiles!carried_by_id(id, full_name),
      in_transit_sources(*)
    `)
    .order('start_date_time', { ascending: false })
    .limit(100)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createInTransitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { sources, carried_by_id, destination, ...inTransitData } = parsed.data
  const supabase = await createClient()

  // If destination is provided, create as CLOSED immediately
  const isClosed = !!destination
  const now = new Date().toISOString()

  const insertData: Record<string, unknown> = {
    ...inTransitData,
    carried_by_id,
    remaining_amount: isClosed ? 0 : inTransitData.total_amount,
    status: isClosed ? 'CLOSED' : 'OPEN',
  }
  if (isClosed) insertData.closed_at = now
  if (destination) {
    insertData.destination_type = destination.destination_type
    insertData.destination_id = destination.destination_id
  }

  const { data: inTransit, error: insertError } = await supabase
    .from('in_transits')
    .insert(insertData)
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const sourcesPayload = sources.map((s) => ({
    ...s,
    in_transit_id: inTransit.id,
  }))

  const { error: sourcesError } = await supabase
    .from('in_transit_sources')
    .insert(sourcesPayload)

  if (sourcesError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Create bank transactions for bank account sources/destinations
  if (isClosed) {
    const today = new Date().toISOString().slice(0, 10)
    const desc = inTransitData.description

    // Source is bank account → OUT transaction
    for (const src of sources) {
      if (src.source_type === 'BANK_ACCOUNT') {
        const { error: txErr } = await supabase.from('bank_transactions').insert({
          bank_account_id: src.source_id,
          transaction_date: today,
          direction: 'OUT',
          amount: src.amount,
          counterparty: 'Паричен трансфер',
          description: desc,
          type: 'OUT_TRANSFER',
          created_by_id: user.id,
        })
        if (txErr) console.error('bank_tx OUT error:', txErr)
      }
    }

    // Destination is bank account → IN transaction
    if (destination!.destination_type === 'BANK_ACCOUNT') {
      const { error: txErr } = await supabase.from('bank_transactions').insert({
        bank_account_id: destination!.destination_id,
        transaction_date: today,
        direction: 'IN',
        amount: inTransitData.total_amount,
        counterparty: 'Паричен трансфер',
        description: desc,
        type: 'IN_OTHER',
        created_by_id: user.id,
      })
      if (txErr) console.error('bank_tx IN error:', txErr)
    }
  }

  return NextResponse.json(inTransit, { status: 201 })
}
