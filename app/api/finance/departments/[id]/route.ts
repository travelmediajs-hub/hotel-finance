import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { updateDepartmentSchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateDepartmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.manager_id !== undefined) updateData.manager_id = parsed.data.manager_id
  if ('authorized_person_id' in parsed.data) updateData.authorized_person_id = parsed.data.authorized_person_id ?? null
  if ('fiscal_device_id' in parsed.data) updateData.fiscal_device_id = parsed.data.fiscal_device_id ?? null
  if ('pos_terminal_id' in parsed.data) updateData.pos_terminal_id = parsed.data.pos_terminal_id ?? null
  if ('sort_order' in parsed.data) updateData.sort_order = parsed.data.sort_order ?? 0
  if ('kind' in parsed.data && parsed.data.kind) {
    updateData.kind = parsed.data.kind
  } else if ('fiscal_device_id' in parsed.data || 'pos_terminal_id' in parsed.data) {
    // Auto-update kind based on POS/fiscal assignment
    updateData.kind = (parsed.data.fiscal_device_id || parsed.data.pos_terminal_id) ? 'REVENUE' : 'EXPENSE'
  }

  const { data, error } = await supabase
    .from('departments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
