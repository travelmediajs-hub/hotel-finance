import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { updatePropertySchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updatePropertySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .update(parsed.data)
    .eq('id', id)
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

  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
