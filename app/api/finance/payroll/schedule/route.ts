import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { z } from 'zod'

const bulkUpsertSchema = z.object({
  entries: z.array(
    z.object({
      employee_id: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(['WORK', 'REST', 'LEAVE', 'SICK']),
      hours: z.number().min(0).max(24).nullable().optional(),
      overtime_hours: z.number().min(0).max(24).nullable().optional(),
    }),
  ),
})

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const propertyId = request.nextUrl.searchParams.get('property_id')
  const month = request.nextUrl.searchParams.get('month')
  if (!propertyId || !month) {
    return NextResponse.json(
      { error: 'validation_error', message: 'property_id and month are required' },
      { status: 400 },
    )
  }

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(propertyId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  // Get employee IDs for this property
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id')
    .eq('property_id', propertyId)

  if (empError) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  const employeeIds = (employees ?? []).map((e) => e.id)
  if (employeeIds.length === 0) {
    return NextResponse.json([])
  }

  // Calculate date range for the month
  const [year, mon] = month.split('-').map(Number)
  const firstDay = `${month}-01`
  const lastDay = new Date(year, mon, 0).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('employee_schedule')
    .select('*')
    .in('employee_id', employeeIds)
    .gte('date', firstDay)
    .lte('date', lastDay)

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = bulkUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('employee_schedule')
    .upsert(parsed.data.entries, { onConflict: 'employee_id,date' })

  if (error) {
    return NextResponse.json(
      { error: 'database_error', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
