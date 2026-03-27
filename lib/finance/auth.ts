// lib/finance/auth.ts
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/finance'

export interface FinanceUser {
  id: string
  fullName: string
  role: UserRole
  isActive: boolean
}

/**
 * Get the current user's finance profile.
 * Returns null if not authenticated or no finance profile exists.
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

  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role as UserRole,
    isActive: data.is_active,
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

/** CO roles can see everything; others are scoped to their properties */
export function isCORole(role: UserRole): boolean {
  return role === 'ADMIN_CO' || role === 'FINANCE_CO'
}
