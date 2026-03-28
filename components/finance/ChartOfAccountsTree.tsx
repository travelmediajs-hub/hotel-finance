'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { AccountForm } from './AccountForm'
import { DepartmentTemplates } from './DepartmentTemplates'
import type { UsaliAccount, UsaliDepartmentTemplate } from '@/types/finance'

type AccountWithTemplate = UsaliAccount & {
  usali_department_templates: { code: string; name: string; category: string } | null
}

interface Props {
  accounts: AccountWithTemplate[]
  templates: UsaliDepartmentTemplate[]
}

export function ChartOfAccountsTree({ accounts: initialAccounts, templates: initialTemplates }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

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

  async function toggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/finance/usali-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    })
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
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
      </div>

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
              <th className="text-center px-3 py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {level1.map(l1 => {
              const isCollapsed = collapsed.has(l1.id)
              const l2Items = children(l1.id)
              return (
                <tbody key={l1.id}>
                  <tr
                    className="border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggle(l1.id)}
                  >
                    <td className="px-3 py-1.5 font-medium">{isCollapsed ? '▸' : '▾'} {l1.code}</td>
                    <td className="px-3 py-1.5 font-medium">{l1.name}</td>
                    <td className="px-3 py-1.5">{l1.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                    <td className="px-3 py-1.5">{l1.usali_department_templates?.name ?? '—'}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={e => { e.stopPropagation(); toggleActive(l1.id, l1.is_active) }}>
                        <Badge variant={l1.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {l1.is_active ? 'Активна' : 'Неактивна'}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed && l2Items.map(l2 => {
                    const l3Items = children(l2.id)
                    return (
                      <tbody key={l2.id}>
                        <tr className="border-b hover:bg-muted/20">
                          <td className="px-3 py-1.5 pl-8">{l2.code}</td>
                          <td className="px-3 py-1.5 pl-8 text-muted-foreground">{l2.name}</td>
                          <td className="px-3 py-1.5">{l2.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5 text-center">
                            <button onClick={() => toggleActive(l2.id, l2.is_active)}>
                              <Badge variant={l2.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                {l2.is_active ? 'Активна' : 'Неактивна'}
                              </Badge>
                            </button>
                          </td>
                        </tr>
                        {l3Items.map(l3 => (
                          <tr key={l3.id} className="border-b hover:bg-muted/20">
                            <td className="px-3 py-1.5 pl-14">{l3.code}</td>
                            <td className="px-3 py-1.5 pl-14 text-muted-foreground">{l3.name}</td>
                            <td className="px-3 py-1.5">{l3.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                            <td className="px-3 py-1.5"></td>
                            <td className="px-3 py-1.5 text-center">
                              <button onClick={() => toggleActive(l3.id, l3.is_active)}>
                                <Badge variant={l3.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                  {l3.is_active ? 'Активна' : 'Неактивна'}
                                </Badge>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    )
                  })}
                </tbody>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
