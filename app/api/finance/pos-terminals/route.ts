import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { createPOSTerminalSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const propertyId = request.nextUrl.searchParams.get('property_id')
  if (!propertyId) {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pos_terminals')
    .select('*')
    .eq('property_id', propertyId)
    .order('tid')

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createPOSTerminalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pos_terminals')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate', message: 'ПОС терминал с този TID вече съществува' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
