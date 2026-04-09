import { createClient } from '@/lib/supabase/server'
import type { FinanceUser } from './auth'

/**
 * Returns true if the given user's effective role has the permission granted.
 * Uses the `role_permissions` table. Falls back to false on any error.
 */
export async function hasPermission(
  user: FinanceUser | null,
  permissionKey: string
): Promise<boolean> {
  if (!user) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from('role_permissions')
    .select('granted')
    .eq('role_key', user.role)
    .eq('permission_key', permissionKey)
    .maybeSingle()
  return !!data?.granted
}

/**
 * Fetch the full set of permission keys granted to a role.
 */
export async function getRolePermissions(roleKey: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('role_permissions')
    .select('permission_key, granted')
    .eq('role_key', roleKey)
  return (data ?? [])
    .filter((r) => r.granted)
    .map((r) => r.permission_key as string)
}

export interface PermissionRow {
  key: string
  module: string
  label: string
  description: string | null
  sort_order: number
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('permissions')
    .select('key, module, label, description, sort_order')
    .order('sort_order')
  return (data ?? []) as PermissionRow[]
}

export interface RoleRow {
  key: string
  label: string
  description: string | null
  is_system: boolean
}

export async function listRoles(): Promise<RoleRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('roles')
    .select('key, label, description, is_system')
    .order('is_system', { ascending: false })
    .order('label')
  return (data ?? []) as RoleRow[]
}
