// lib/finance/auth.ts
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/finance'
import { isCORole } from './roles'
export { isCORole } from './roles'

export const SIMULATE_ROLE_COOKIE = 'finance_simulate_role'
export const SIMULATE_PROPERTY_COOKIE = 'finance_simulate_property'
export const ACTIVE_PROPERTY_COOKIE = 'finance_active_property'
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

  // Simulating non-CO role → scope to the chosen property if set
  if (user.isSimulating) {
    const cookieStore = await cookies()
    const propCookie = cookieStore.get(SIMULATE_PROPERTY_COOKIE)
    if (propCookie?.value) {
      return [propCookie.value]
    }
    const supabase = await createClient()
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('status', 'ACTIVE')
    return (data ?? []).map(p => p.id)
  }

  // Real non-CO user → read from access table. Order the IDs by property
  // name to match the banner/sidebar picker, so the "first accessible"
  // fallback is consistent across UI and data scoping.
  const supabase = await createClient()
  const { data: access } = await supabase
    .from('user_property_access')
    .select('property_id')
    .eq('user_id', user.id)
  const rawIds = (access ?? []).map(a => a.property_id)
  let accessibleIds: string[] = rawIds
  if (rawIds.length > 1) {
    const { data: props } = await supabase
      .from('properties')
      .select('id, name')
      .in('id', rawIds)
      .order('name', { ascending: true })
    if (props && props.length > 0) {
      accessibleIds = props.map(p => p.id)
    }
  }

  // Scope non-CO users to a single active property at a time so their view
  // matches the property picker in the banner/sidebar. If the cookie is
  // missing or stale, fall back to the first accessible property (same
  // default the layout applies when rendering the banner).
  if (accessibleIds.length > 1) {
    const cookieStore = await cookies()
    const activeId = cookieStore.get(ACTIVE_PROPERTY_COOKIE)?.value
    if (activeId && accessibleIds.includes(activeId)) {
      return [activeId]
    }
    return [accessibleIds[0]]
  }

  return accessibleIds
}

/**
 * Get the full list of accessible property IDs for a non-CO user,
 * ignoring any active-property selection. Returns null for CO roles.
 * Use this when you need the user's full access footprint (e.g., to
 * render the property picker).
 */
export async function getAllAccessiblePropertyIds(
  user: FinanceUser
): Promise<string[] | null> {
  if (isCORole(user.role)) return null

  if (user.isSimulating) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('status', 'ACTIVE')
    return (data ?? []).map(p => p.id)
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('user_property_access')
    .select('property_id')
    .eq('user_id', user.id)
  return (data ?? []).map(a => a.property_id)
}
