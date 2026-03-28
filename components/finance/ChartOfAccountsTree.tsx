'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AccountForm } from './AccountForm'
import { DepartmentTemplates } from './DepartmentTemplates'
import type { UsaliAccount, UsaliDepartmentTemplate } from '@/types/finance'

type AccountWithTemplate = UsaliAccount & {
  usali_department_templates: { code: string; name: string; category: string } | null
}

interface Props {
  accounts: AccountWithTemplate[]
  templates: UsaliDepartmentTemplate[]
  properties: Array<{ id: string; name: string }>
}

export function ChartOfAccountsTree({ accounts: initialAccounts, templates: initialTemplates, properties }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  const fetchHidden = useCallback(async (propId: string) => {
    if (!propId) { setHiddenIds(new Set()); return }
    const res = await fetch(`/api/finance/property-hidden-accounts?property_id=${propId}`)
    if (res.ok) {
      const ids: string[] = await res.json()
      setHiddenIds(new Set(ids))
    }
  }, [])

  useEffect(() => {
    fetchHidden(selectedPropertyId)
  }, [selectedPropertyId, fetchHidden])

  const level1 = initialAccounts.filter(a => a.level === 1)

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function children(parentId: string) {
    return initialAccounts.filter(a => a.parent_id === parentId)
  }

  async function toggleGlobalActive(id: string, currentActive: boolean) {
    await fetch(`/api/finance/usali-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    })
    router.refresh()
  }

  async function togglePropertyVisibility(accountId: string) {
    if (!selectedPropertyId) return
    const isHidden = hiddenIds.has(accountId)
    setToggling(prev => new Set(prev).add(accountId))

    await fetch('/api/finance/property-hidden-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: selectedPropertyId,
        account_id: accountId,
        hidden: !isHidden,
      }),
    })

    setHiddenIds(prev => {
      const next = new Set(prev)
      if (isHidden) next.delete(accountId)
      else next.add(accountId)
      return next
    })
    setToggling(prev => { const n = new Set(prev); n.delete(accountId); return n })
  }

  const propertyMode = selectedPropertyId !== ''

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Нова сметка
        </button>
        <button
          onClick={() => setShowTemplates(true)}
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
        >
          Департаменти
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Обект:</span>
          <Select value={selectedPropertyId || '_all'} onValueChange={v => setSelectedPropertyId(v === '_all' ? '' : v)}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Всички (глобално)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all" className="text-xs">Всички (глобално)</SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {propertyMode && (
        <p className="text-xs text-muted-foreground mb-3">
          Скрийте/покажете сметки за избрания обект. Скритите сметки няма да се показват при въвеждане на разходи и приходи.
        </p>
      )}

      {showTemplates && (
        <DepartmentTemplates
          templates={initialTemplates}
          onClose={() => { setShowTemplates(false); router.refresh() }}
        />
      )}

      {showForm && (
        <AccountForm
          templates={initialTemplates.filter(t => t.is_active)}
          accounts={initialAccounts}
          onClose={() => { setShowForm(false); router.refresh() }}
        />
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2 font-medium">Код</th>
              <th className="text-left px-3 py-2 font-medium">Наименование</th>
              <th className="text-left px-3 py-2 font-medium">Тип</th>
              <th className="text-left px-3 py-2 font-medium">Департамент</th>
              <th className="text-center px-3 py-2 font-medium">
                {propertyMode ? 'Видимост' : 'Статус'}
              </th>
            </tr>
          </thead>
          <tbody>
            {level1.map(l1 => {
              const isCollapsed = collapsed.has(l1.id)
              const l2Items = children(l1.id)
              return (
                <Fragment key={l1.id}>
                  <tr
                    className="border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggle(l1.id)}
                  >
                    <td className="px-3 py-1.5 font-medium">{isCollapsed ? '▸' : '▾'} {l1.code}</td>
                    <td className="px-3 py-1.5 font-medium">{l1.name}</td>
                    <td className="px-3 py-1.5">{l1.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                    <td className="px-3 py-1.5">{l1.usali_department_templates?.name ?? '—'}</td>
                    <td className="px-3 py-1.5 text-center">
                      {propertyMode ? (
                        <VisibilityButton
                          hidden={hiddenIds.has(l1.id)}
                          loading={toggling.has(l1.id)}
                          onClick={e => { e.stopPropagation(); togglePropertyVisibility(l1.id) }}
                        />
                      ) : (
                        <button onClick={e => { e.stopPropagation(); toggleGlobalActive(l1.id, l1.is_active) }}>
                          <Badge variant={l1.is_active ? 'default' : 'secondary'} className="text-[10px]">
                            {l1.is_active ? 'Активна' : 'Неактивна'}
                          </Badge>
                        </button>
                      )}
                    </td>
                  </tr>
                  {!isCollapsed && l2Items.map(l2 => {
                    const l3Items = children(l2.id)
                    return (
                      <Fragment key={l2.id}>
                        <tr className="border-b hover:bg-muted/20">
                          <td className="px-3 py-1.5 pl-8">{l2.code}</td>
                          <td className="px-3 py-1.5 pl-8 text-muted-foreground">{l2.name}</td>
                          <td className="px-3 py-1.5">{l2.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5 text-center">
                            {propertyMode ? (
                              <VisibilityButton
                                hidden={hiddenIds.has(l2.id)}
                                loading={toggling.has(l2.id)}
                                onClick={() => togglePropertyVisibility(l2.id)}
                              />
                            ) : (
                              <button onClick={() => toggleGlobalActive(l2.id, l2.is_active)}>
                                <Badge variant={l2.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                  {l2.is_active ? 'Активна' : 'Неактивна'}
                                </Badge>
                              </button>
                            )}
                          </td>
                        </tr>
                        {l3Items.map(l3 => (
                          <tr key={l3.id} className="border-b hover:bg-muted/20">
                            <td className="px-3 py-1.5 pl-14">{l3.code}</td>
                            <td className="px-3 py-1.5 pl-14 text-muted-foreground">{l3.name}</td>
                            <td className="px-3 py-1.5">{l3.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                            <td className="px-3 py-1.5"></td>
                            <td className="px-3 py-1.5 text-center">
                              {propertyMode ? (
                                <VisibilityButton
                                  hidden={hiddenIds.has(l3.id)}
                                  loading={toggling.has(l3.id)}
                                  onClick={() => togglePropertyVisibility(l3.id)}
                                />
                              ) : (
                                <button onClick={() => toggleGlobalActive(l3.id, l3.is_active)}>
                                  <Badge variant={l3.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                    {l3.is_active ? 'Активна' : 'Неактивна'}
                                  </Badge>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VisibilityButton({ hidden, loading, onClick }: { hidden: boolean; loading: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} disabled={loading} className="transition-opacity disabled:opacity-50">
      <Badge
        variant={hidden ? 'secondary' : 'default'}
        className="text-[10px]"
      >
        {hidden ? 'Скрита' : 'Видима'}
      </Badge>
    </button>
  )
}
