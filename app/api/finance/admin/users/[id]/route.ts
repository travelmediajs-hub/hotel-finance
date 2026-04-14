import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { z } from 'zod'

const updateSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).nullable().optional(),
  role: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  property_ids: z.array(z.string().uuid()).optional(),
  password: z.string().min(6).max(100).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'users.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Lockout protection: prevent self-deactivation or self role change
  if (id === user.id) {
    if (parsed.data.is_active === false) {
      return NextResponse.json(
        { error: 'self_lockout', message: 'Не можеш да деактивираш собствения си акаунт' },
        { status: 400 }
      )
    }
    if (parsed.data.role && parsed.data.role !== user.role) {
      return NextResponse.json(
        { error: 'self_lockout', message: 'Не можеш да променяш собствената си роля' },
        { status: 400 }
      )
    }
  }

  const supabase = await createClient()
  const { property_ids, password, ...profileUpdate } = parsed.data

  if (password) {
    let admin
    try {
      admin = createAdminClient()
    } catch {
      return NextResponse.json(
        { error: 'service_role_missing', message: 'SUPABASE_SERVICE_ROLE_KEY не е конфигуриран' },
        { status: 500 },
      )
    }
    const { error: pwError } = await admin.auth.admin.updateUserById(id, { password })
    if (pwError) {
      return NextResponse.json(
        { error: 'password_error', message: pwError.message },
        { status: 400 },
      )
    }
  }

  if (Object.keys(profileUpdate).length > 0) {
    // Verify role exists if being changed
    if (profileUpdate.role) {
      const { data: role } = await supabase
        .from('roles')
        .select('key')
        .eq('key', profileUpdate.role)
        .maybeSingle()
      if (!role) {
        return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
      }
    }
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...profileUpdate, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      return NextResponse.json(
        { error: 'database_error', message: error.message },
        { status: 500 }
      )
    }
  }

  if (property_ids !== undefined) {
    // Replace property access set
    const { error: delError } = await supabase
      .from('user_property_access')
      .delete()
      .eq('user_id', id)
    if (delError) {
      return NextResponse.json(
        { error: 'database_error', message: delError.message },
        { status: 500 }
      )
    }
    if (property_ids.length > 0) {
      const rows = property_ids.map((pid) => ({ user_id: id, property_id: pid }))
      const { error: insError } = await supabase.from('user_property_access').insert(rows)
      if (insError) {
        return NextResponse.json(
          { error: 'database_error', message: insError.message },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'users.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (id === user.id) {
    return NextResponse.json(
      { error: 'self_lockout', message: 'Не можеш да изтриеш собствения си акаунт' },
      { status: 400 }
    )
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'service_role_missing', message: 'SUPABASE_SERVICE_ROLE_KEY не е конфигуриран' },
      { status: 500 }
    )
  }

  // Soft delete: deactivate profile. Hard delete of auth user is destructive.
  const { error } = await admin
    .from('user_profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
