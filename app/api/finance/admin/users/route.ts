import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  phone: z.string().max(20).optional().nullable(),
  role: z.string().min(1),
  property_ids: z.array(z.string().uuid()).default([]),
})

export async function GET() {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'users.view'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, phone, role, is_active, created_at, updated_at')
    .order('full_name')
  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  const { data: access } = await supabase
    .from('user_property_access')
    .select('user_id, property_id, properties(name)')

  const byUser: Record<string, Array<{ id: string; name: string }>> = {}
  for (const row of access ?? []) {
    const list = byUser[row.user_id] ?? (byUser[row.user_id] = [])
    const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties
    list.push({ id: row.property_id, name: prop?.name ?? '' })
  }

  const enriched = (users ?? []).map((u) => ({
    ...u,
    properties: byUser[u.id] ?? [],
  }))
  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'users.manage'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify role exists
  const { data: role } = await supabase.from('roles').select('key').eq('key', parsed.data.role).maybeSingle()
  if (!role) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      {
        error: 'service_role_missing',
        message: 'SUPABASE_SERVICE_ROLE_KEY не е конфигуриран в .env.local',
      },
      { status: 500 }
    )
  }

  const { email, full_name, phone, role: roleKey, property_ids } = parsed.data

  const redirectTo = `${request.nextUrl.origin}/auth/login`
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name },
  })
  if (inviteError || !invited?.user) {
    return NextResponse.json(
      { error: 'invite_failed', message: inviteError?.message ?? 'Неуспешна покана' },
      { status: 400 }
    )
  }

  const newUserId = invited.user.id

  const { error: profileError } = await admin.from('user_profiles').upsert(
    {
      id: newUserId,
      full_name,
      phone: phone ?? null,
      role: roleKey,
      is_active: true,
    },
    { onConflict: 'id' }
  )
  if (profileError) {
    return NextResponse.json(
      { error: 'profile_error', message: profileError.message },
      { status: 500 }
    )
  }

  if (property_ids.length > 0) {
    const rows = property_ids.map((pid) => ({ user_id: newUserId, property_id: pid }))
    const { error: accessError } = await admin
      .from('user_property_access')
      .upsert(rows, { onConflict: 'user_id,property_id' })
    if (accessError) {
      return NextResponse.json(
        { error: 'access_error', message: accessError.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true, user_id: newUserId, email }, { status: 201 })
}
