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

  const { pos_terminal_ids, ...departmentData } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departments')
    .insert(departmentData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  if (pos_terminal_ids && pos_terminal_ids.length > 0) {
    const junctionRows = pos_terminal_ids.map(tid => ({
      department_id: data.id,
      pos_terminal_id: tid,
    }))
    await supabase.from('department_pos_terminals').insert(junctionRows)
  }

  return NextResponse.json(data, { status: 201 })
}
