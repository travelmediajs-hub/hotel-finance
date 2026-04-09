import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SIMULATE_ROLE_COOKIE, SIMULATE_PROPERTY_COOKIE } from '@/lib/finance/auth'
import type { UserRole } from '@/types/finance'

const VALID_ROLES: UserRole[] = ['ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD']

export async function POST(request: NextRequest) {
  // Verify real role is ADMIN_CO (read directly from DB, not getFinanceUser)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const role = body.role as string
  const propertyId = (body.property_id ?? null) as string | null

  const cookieStore = await cookies()

  // Clear simulation
  if (!role || role === 'ADMIN_CO') {
    cookieStore.delete(SIMULATE_ROLE_COOKIE)
    cookieStore.delete(SIMULATE_PROPERTY_COOKIE)
    return NextResponse.json({ role: 'ADMIN_CO', simulating: false })
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  // Non-CO simulated roles (MANAGER / DEPT_HEAD) must be scoped to a single property
  const needsProperty = role === 'MANAGER' || role === 'DEPT_HEAD'
  if (needsProperty && !propertyId) {
    return NextResponse.json(
      { error: 'property_required', message: 'Избери обект за симулация' },
      { status: 400 }
    )
  }

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  }

  cookieStore.set(SIMULATE_ROLE_COOKIE, role, cookieOpts)
  if (needsProperty && propertyId) {
    cookieStore.set(SIMULATE_PROPERTY_COOKIE, propertyId, cookieOpts)
  } else {
    cookieStore.delete(SIMULATE_PROPERTY_COOKIE)
  }

  return NextResponse.json({ role, property_id: propertyId, simulating: true })
}
