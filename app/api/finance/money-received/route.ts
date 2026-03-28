import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createMoneyReceivedSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const propertyId = searchParams.get('property_id')
  const status = searchParams.get('status')
  const purpose = searchParams.get('purpose')

  let query = supabase
    .from('money_received')
    .select('*, properties(name)')
    .order('sent_date', { ascending: false })
    .limit(200)

  // MANAGER is scoped to their own properties via RLS (user_property_access)
  // CO roles see everything — no additional filter needed
  if (!isCORole(user.role)) {
    const { data: accessRows } = await supabase
      .from('user_property_access')
      .select('property_id')
      .eq('user_id', user.id)

    const accessibleIds = (accessRows ?? []).map((r) => r.property_id)
    if (accessibleIds.length === 0) {
      return NextResponse.json([])
    }
    query = query.in('property_id', accessibleIds)
  }

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (purpose) {
    query = query.eq('purpose', purpose)
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
  const parsed = await createMoneyReceivedSchema.safeParseAsync(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('money_received')
    .insert({
      ...parsed.data,
      sent_by_id: user.id,
      status: 'SENT',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
