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

  const { sources, ...inTransitData } = parsed.data
  const supabase = await createClient()

  const { data: inTransit, error: insertError } = await supabase
    .from('in_transits')
    .insert({
      ...inTransitData,
      carried_by_id: user.id,
      remaining_amount: inTransitData.total_amount,
    })
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

  return NextResponse.json(inTransit, { status: 201 })
}
