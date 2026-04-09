import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { z } from 'zod'

const updateRoleSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
})

interface RouteParams { params: Promise<{ key: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { key } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'roles.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { key } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'roles.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const supabase = await createClient()

  // Prevent deleting system roles
  const { data: role } = await supabase.from('roles').select('is_system').eq('key', key).single()
  if (!role) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (role.is_system) {
    return NextResponse.json({ error: 'forbidden', message: 'Системни роли не могат да бъдат изтривани' }, { status: 400 })
  }

  // Prevent deleting role in use
  const { count } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', key)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'role_in_use', message: 'Ролята е назначена на потребители' }, { status: 400 })
  }

  const { error } = await supabase.from('roles').delete().eq('key', key)
  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
