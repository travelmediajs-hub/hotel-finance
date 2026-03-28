import type { UserRole } from '@/types/finance'

/** CO roles can see everything; others are scoped to their properties */
export function isCORole(role: UserRole): boolean {
  return role === 'ADMIN_CO' || role === 'FINANCE_CO'
}
