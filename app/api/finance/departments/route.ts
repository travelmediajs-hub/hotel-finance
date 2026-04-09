import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { createDepartmentSchema } from '@/lib/finance/schemas'

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
    .from('departments')
    .select('*')
    .eq('property_id', propertyId)
    .order('sort_order')
    .order('name')

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
  const parsed = createDepartmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { authorized_person_id, fiscal_device_id, pos_terminal_id, sort_order, kind, ...requiredFields } = parsed.data
  const insertData: Record<string, unknown> = { ...requiredFields }
  if (authorized_person_id) insertData.authorized_person_id = authorized_person_id
  if (fiscal_device_id) insertData.fiscal_device_id = fiscal_device_id
  if (pos_terminal_id) insertData.pos_terminal_id = pos_terminal_id
  if (sort_order !== undefined) insertData.sort_order = sort_order
  // Infer kind: a department with a fiscal device or POS terminal is a revenue point
  insertData.kind = kind ?? (fiscal_device_id || pos_terminal_id ? 'REVENUE' : 'EXPENSE')

  const { data, error } = await supabase
    .from('departments')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
