import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission, listPermissions, listRoles } from '@/lib/finance/permissions'
import { AdminView } from '@/components/finance/AdminView'

export default async function AdminPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/auth/login')

  const canUsers = await hasPermission(user, 'users.view')
  const canRoles = await hasPermission(user, 'roles.view')
  if (!canUsers && !canRoles) redirect('/finance/dashboard')

  const supabase = await createClient()

  const [permissions, roles, { data: properties }, { data: users }, { data: access }, { data: rolePerms }] =
    await Promise.all([
      listPermissions(),
      listRoles(),
      supabase.from('properties').select('id, name').order('name'),
      supabase
        .from('user_profiles')
        .select('id, full_name, phone, role, is_active, created_at')
        .order('full_name'),
      supabase.from('user_property_access').select('user_id, property_id, properties(name)'),
      supabase.from('role_permissions').select('role_key, permission_key, granted'),
    ])

  const byUser: Record<string, { id: string; name: string }[]> = {}
  for (const row of access ?? []) {
    const list = byUser[row.user_id] ?? (byUser[row.user_id] = [])
    const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties
    list.push({ id: row.property_id, name: (prop as { name?: string } | null)?.name ?? '' })
  }
  const enrichedUsers = (users ?? []).map((u) => ({
    ...u,
    properties: byUser[u.id] ?? [],
  }))

  const canManageUsers = await hasPermission(user, 'users.manage')
  const canManageRoles = await hasPermission(user, 'roles.manage')

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <AdminView
        currentUserId={user.id}
        currentUserRole={user.role}
        permissions={permissions}
        roles={roles}
        properties={properties ?? []}
        users={enrichedUsers}
        rolePermissions={rolePerms ?? []}
        canUsersView={canUsers}
        canUsersManage={canManageUsers}
        canRolesView={canRoles}
        canRolesManage={canManageRoles}
      />
    </div>
  )
}
