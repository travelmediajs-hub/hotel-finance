import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { z } from 'zod'

const updateEmployeeSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  usali_department_id: z.string().uuid().optional(),
  position: z.string().max(200).optional().nullable(),
  contract_salary: z.number().min(0).optional(),
  actual_salary: z.number().min(0).optional(),
  contract_hours_per_day: z.number().int().min(1).max(24).optional(),
  is_active: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateEmployeeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // Verify MANAGER has access to the employee's property
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds) {
    const { data: employee } = await supabase
      .from('employees')
      .select('property_id')
      .eq('id', id)
      .single()

    if (!employee || !allowedIds.includes(employee.property_id)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'database_error', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json(data)
}
