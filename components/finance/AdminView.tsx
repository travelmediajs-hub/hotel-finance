'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Save, Trash2, UserPlus } from 'lucide-react'
import type { PermissionRow, RoleRow } from '@/lib/finance/permissions'

interface UserRow {
  id: string
  full_name: string
  phone: string | null
  role: string
  is_active: boolean
  created_at: string
  properties: { id: string; name: string }[]
}

interface RolePermRow {
  role_key: string
  permission_key: string
  granted: boolean
}

interface Property { id: string; name: string }

interface Props {
  currentUserId: string
  currentUserRole: string
  permissions: PermissionRow[]
  roles: RoleRow[]
  properties: Property[]
  users: UserRow[]
  rolePermissions: RolePermRow[]
  canUsersView: boolean
  canUsersManage: boolean
  canRolesView: boolean
  canRolesManage: boolean
}

export function AdminView(props: Props) {
  const defaultTab = props.canUsersView ? 'users' : 'roles'
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        {props.canUsersView && <TabsTrigger value="users">Потребители</TabsTrigger>}
        {props.canRolesView && <TabsTrigger value="roles">Роли и права</TabsTrigger>}
      </TabsList>

      {props.canUsersView && (
        <TabsContent value="users">
          <UsersTab {...props} />
        </TabsContent>
      )}
      {props.canRolesView && (
        <TabsContent value="roles">
          <RolesTab {...props} />
        </TabsContent>
      )}
    </Tabs>
  )
}

// ======================= USERS TAB =======================

function UsersTab({
  users, roles, properties, canUsersManage, currentUserId,
}: Props) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)

  async function toggleActive(u: UserRow) {
    if (u.id === currentUserId) return
    const res = await fetch(`/api/finance/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !u.is_active }),
    })
    if (!res.ok) {
      alert('Грешка при обновяване')
      return
    }
    router.refresh()
  }

  async function changeRole(u: UserRow, role: string) {
    if (u.id === currentUserId) return
    const res = await fetch(`/api/finance/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) {
      alert('Грешка при смяна на роля')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Потребители ({users.length})</h2>
        {canUsersManage && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <Button size="sm" className="h-7 text-xs" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Покани
            </Button>
            <InviteDialog
              roles={roles}
              properties={properties}
              onDone={() => {
                setInviteOpen(false)
                router.refresh()
              }}
            />
          </Dialog>
        )}
      </div>

      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-2 py-1.5">Име</th>
              <th className="px-2 py-1.5">Телефон</th>
              <th className="px-2 py-1.5">Роля</th>
              <th className="px-2 py-1.5">Обекти</th>
              <th className="px-2 py-1.5">Статус</th>
              <th className="px-2 py-1.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-2 py-1.5 font-medium">
                  {u.full_name}
                  {u.id === currentUserId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(вие)</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{u.phone ?? '—'}</td>
                <td className="px-2 py-1.5">
                  {canUsersManage && u.id !== currentUserId ? (
                    <Select value={u.role} onValueChange={(v) => v && changeRole(u, v)}>
                      <SelectTrigger className="h-6 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.key} value={r.key} className="text-xs">
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {roles.find((r) => r.key === u.role)?.label ?? u.role}
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {u.properties.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span>{u.properties.map((p) => p.name).join(', ')}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {u.is_active ? (
                    <Badge className="text-[10px] bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Неактивен</Badge>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {canUsersManage && u.id !== currentUserId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? 'Деактивирай' : 'Активирай'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">
                  Няма потребители
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InviteDialog({
  roles, properties, onDone,
}: {
  roles: RoleRow[]
  properties: Property[]
  onDone: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? '')
  const [propertyIds, setPropertyIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showProperties = roleKey === 'MANAGER' || roleKey === 'DEPT_HEAD'

  function toggleProperty(id: string) {
    setPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/finance/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          phone: phone || null,
          role: roleKey,
          property_ids: showProperties ? propertyIds : [],
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.message ?? 'Грешка')
        return
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Покани нов потребител</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-xs">
        <div>
          <Label className="text-xs">Имейл</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Име</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Телефон</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Роля</Label>
          <Select value={roleKey} onValueChange={(v) => v && setRoleKey(v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.key} value={r.key} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showProperties && (
          <div>
            <Label className="text-xs">Обекти</Label>
            <div className="grid grid-cols-2 gap-1 border border-border rounded p-2 max-h-40 overflow-y-auto">
              {properties.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={propertyIds.includes(p.id)}
                    onChange={() => toggleProperty(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <DialogFooter>
        <Button
          size="sm"
          onClick={submit}
          disabled={saving || !email || !fullName || !roleKey}
        >
          {saving ? 'Изпращане...' : 'Изпрати покана'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ======================= ROLES TAB =======================

function RolesTab({
  roles, permissions, rolePermissions, canRolesManage, currentUserRole,
}: Props) {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState(roles[0]?.key ?? '')
  const [createOpen, setCreateOpen] = useState(false)

  // Local matrix state for the selected role: permission_key -> granted
  const initialGrants = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const p of permissions) {
      const rp = rolePermissions.find(
        (x) => x.role_key === selectedRole && x.permission_key === p.key
      )
      map[p.key] = rp?.granted ?? false
    }
    return map
  }, [permissions, rolePermissions, selectedRole])

  const [grants, setGrants] = useState<Record<string, boolean>>(initialGrants)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset when role changes
  useEffect(() => {
    setGrants(initialGrants)
    setDirty(false)
  }, [initialGrants])

  const modules = useMemo(() => {
    const m: Record<string, PermissionRow[]> = {}
    for (const p of permissions) {
      ;(m[p.module] ??= []).push(p)
    }
    return m
  }, [permissions])

  const currentRole = roles.find((r) => r.key === selectedRole)

  function toggle(key: string) {
    setGrants((prev) => ({ ...prev, [key]: !prev[key] }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/finance/admin/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_key: selectedRole,
          grants: Object.entries(grants).map(([permission_key, granted]) => ({
            permission_key,
            granted,
          })),
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        alert(body.message ?? 'Грешка')
        return
      }
      setDirty(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function deleteRole() {
    if (!currentRole || currentRole.is_system) return
    if (!confirm(`Изтриване на роля "${currentRole.label}"?`)) return
    const res = await fetch(`/api/finance/admin/roles/${currentRole.key}`, {
      method: 'DELETE',
    })
    const body = await res.json()
    if (!res.ok) {
      alert(body.message ?? 'Грешка')
      return
    }
    setSelectedRole(roles.find((r) => r.key !== currentRole.key)?.key ?? '')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={selectedRole} onValueChange={(v) => v && setSelectedRole(v)}>
          <SelectTrigger className="h-8 text-xs w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.key} value={r.key} className="text-xs">
                {r.label} {r.is_system && <span className="text-muted-foreground ml-1">(системна)</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canRolesManage && (
          <>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Нова роля
              </Button>
              <CreateRoleDialog
                onDone={(newKey) => {
                  setCreateOpen(false)
                  if (newKey) setSelectedRole(newKey)
                  router.refresh()
                }}
              />
            </Dialog>
            {currentRole && !currentRole.is_system && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-red-500"
                onClick={deleteRole}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Изтрий
              </Button>
            )}
            <div className="flex-1" />
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!dirty || saving}
              onClick={save}
            >
              <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Запазване...' : 'Запази'}
            </Button>
          </>
        )}
      </div>

      {currentRole?.description && (
        <p className="text-xs text-muted-foreground">{currentRole.description}</p>
      )}

      {selectedRole === currentUserRole && (
        <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
          Редактирате собствената си роля — критични права (users.manage, roles.manage) не могат да бъдат премахнати.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(modules).map(([moduleName, perms]) => (
          <div key={moduleName} className="border border-border rounded overflow-hidden">
            <div className="bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wider">
              {moduleName}
            </div>
            <div className="divide-y divide-border">
              {perms.map((p) => (
                <label
                  key={p.key}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={grants[p.key] ?? false}
                    disabled={!canRolesManage}
                    onChange={() => toggle(p.key)}
                  />
                  <span className="flex-1">{p.label}</span>
                  <code className="text-[9px] text-muted-foreground">{p.key}</code>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateRoleDialog({ onDone }: { onDone: (newKey?: string) => void }) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/finance/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, label, description: description || null }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.message ?? 'Грешка')
        return
      }
      onDone(body.key)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Нова роля</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-xs">
        <div>
          <Label className="text-xs">Ключ (само главни букви, цифри, _)</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="MY_ROLE"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">Име</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Описание</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <DialogFooter>
        <Button size="sm" onClick={submit} disabled={saving || !key || !label}>
          {saving ? 'Създаване...' : 'Създай'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
