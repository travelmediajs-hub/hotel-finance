import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { z } from 'zod'

const createEmployeeSchema = z.object({
  property_id: z.string().uuid(),
  usali_department_id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  position_id: z.string().uuid().optional().nullable(),
  contract_salary: z.number().min(0),
  actual_salary: z.number().min(0),
  contract_hours_per_day: z.number().int().min(1).max(24).default(8),
})

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  let query = supabase
    .from('employees')
    .select('*, usali_department_templates(code, name), positions(name), properties(name)')
    .order('full_name')

  const propertyId = request.nextUrl.searchParams.get('property_id')
  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds) {
    query = query.in('property_id', allowedIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createEmployeeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(parsed.data.property_id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'database_error', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json(data, { status: 201 })
}
