import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createPropertySchema } from '@/lib/finance/schemas'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  let query = supabase
    .from('properties')
    .select('*')
    .order('name')

  if (!isCORole(user.role)) {
    const { data: access } = await supabase
      .from('user_property_access')
      .select('property_id')
      .eq('user_id', user.id)

    const propertyIds = access?.map(a => a.property_id) ?? []
    if (propertyIds.length === 0) {
      return NextResponse.json([])
    }
    query = query.in('id', propertyIds)
  }

  const { data, error } = await query

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
  const parsed = createPropertySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('properties')
    .insert({ ...parsed.data, created_by: user.id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate', message: 'Обект с това име или ЕИК вече съществува' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
