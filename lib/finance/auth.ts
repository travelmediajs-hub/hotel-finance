// lib/finance/auth.ts
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/finance'
import { isCORole } from './roles'
export { isCORole } from './roles'

export const SIMULATE_ROLE_COOKIE = 'finance_simulate_role'
const VALID_ROLES: UserRole[] = ['ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD']

export interface FinanceUser {
  id: string
  fullName: string
  role: UserRole
  realRole: UserRole
  isActive: boolean
  isSimulating: boolean
}

/**
 * Get the current user's finance profile.
 * If the real role is ADMIN_CO and a simulation cookie is set, the returned
 * role will be the simulated one. `realRole` always contains the DB role.
 */
export async function getFinanceUser(): Promise<FinanceUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!data || !data.is_active) return null

  const realRole = data.role as UserRole

  // Only ADMIN_CO can simulate other roles
  let effectiveRole = realRole
  let isSimulating = false
  if (realRole === 'ADMIN_CO') {
    const cookieStore = await cookies()
    const simCookie = cookieStore.get(SIMULATE_ROLE_COOKIE)
    if (simCookie && VALID_ROLES.includes(simCookie.value as UserRole)) {
      effectiveRole = simCookie.value as UserRole
      isSimulating = effectiveRole !== realRole
    }
  }

  return {
    id: data.id,
    fullName: data.full_name,
    role: effectiveRole,
    realRole,
    isActive: data.is_active,
    isSimulating,
  }
}

/**
 * Require the current user to have one of the specified roles.
 * Returns the FinanceUser if authorized, null otherwise.
 */
export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<FinanceUser | null> {
  const user = await getFinanceUser()
  if (!user) return null
  if (!allowedRoles.includes(user.role)) return null
  return user
}

/**
 * Get property IDs accessible to the user.
 * When ADMIN_CO is simulating a non-CO role, returns ALL properties
 * (since no real user_property_access rows exist for the admin).
 * For real non-CO users, reads from user_property_access.
 * Returns null for CO roles (meaning "all properties").
 */
export async function getUserPropertyIds(
  user: FinanceUser
): Promise<string[] | null> {
  // CO roles see everything
  if (isCORole(user.role)) return null

  // Simulating non-CO role → return all active property IDs
  if (user.isSimulating) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('status', 'ACTIVE')
    return (data ?? []).map(p => p.id)
  }

  // Real non-CO user → read from access table
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_property_access')
    .select('property_id')
    .eq('user_id', user.id)
  return (data ?? []).map(a => a.property_id)
}
