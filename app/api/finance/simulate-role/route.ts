import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SIMULATE_ROLE_COOKIE } from '@/lib/finance/auth'
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

  const cookieStore = await cookies()

  // Clear simulation
  if (!role || role === 'ADMIN_CO') {
    cookieStore.delete(SIMULATE_ROLE_COOKIE)
    return NextResponse.json({ role: 'ADMIN_CO', simulating: false })
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  cookieStore.set(SIMULATE_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  return NextResponse.json({ role, simulating: true })
}
