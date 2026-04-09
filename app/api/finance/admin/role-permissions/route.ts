import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { z } from 'zod'

const updateSchema = z.object({
  role_key: z.string().min(1),
  grants: z.array(
    z.object({
      permission_key: z.string().min(1),
      granted: z.boolean(),
    })
  ),
})

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'roles.view'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const supabase = await createClient()
  const roleKey = request.nextUrl.searchParams.get('role_key')
  let query = supabase.from('role_permissions').select('role_key, permission_key, granted')
  if (roleKey) query = query.eq('role_key', roleKey)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'roles.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })
  }

  const { role_key, grants } = parsed.data

  // Lockout protection: don't let current user remove 'roles.manage' or 'users.manage' from their own role
  if (role_key === user.role) {
    const criticalRemoved = grants.some(
      (g) => (g.permission_key === 'roles.manage' || g.permission_key === 'users.manage') && !g.granted
    )
    if (criticalRemoved) {
      return NextResponse.json(
        { error: 'self_lockout', message: 'Не можеш да премахнеш собствените си админ права' },
        { status: 400 }
      )
    }
  }

  const supabase = await createClient()
  const rows = grants.map((g) => ({
    role_key,
    permission_key: g.permission_key,
    granted: g.granted,
  }))
  const { error } = await supabase
    .from('role_permissions')
    .upsert(rows, { onConflict: 'role_key,permission_key' })
  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated: rows.length })
}
