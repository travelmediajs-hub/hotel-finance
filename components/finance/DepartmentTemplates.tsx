'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { UsaliDepartmentTemplate } from '@/types/finance'

interface Props {
  templates: UsaliDepartmentTemplate[]
  onClose: () => void
}

const categoryLabels: Record<string, string> = {
  OPERATED: 'Оперативен',
  UNDISTRIBUTED: 'Неразпределен',
  FIXED: 'Фиксиран',
}

export function DepartmentTemplates({ templates, onClose }: Props) {
  const [items, setItems] = useState(templates)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(id: string, currentActive: boolean) {
    setSaving(id)
    try {
      const res = await fetch(`/api/finance/usali-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      if (res.ok) {
        setItems(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentActive } : t))
      }
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mb-4 p-4 border rounded-md bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">USALI Департаменти</h3>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md"
        >
          Затвори
        </button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left px-3 py-2 font-medium">Код</th>
            <th className="text-left px-3 py-2 font-medium">Наименование</th>
            <th className="text-left px-3 py-2 font-medium">Категория</th>
            <th className="text-center px-3 py-2 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id} className="border-b hover:bg-muted/20">
              <td className="px-3 py-1.5">{t.code}</td>
              <td className="px-3 py-1.5">{t.name}</td>
              <td className="px-3 py-1.5">{categoryLabels[t.category] ?? t.category}</td>
              <td className="px-3 py-1.5 text-center">
                <button
                  onClick={() => toggle(t.id, t.is_active)}
                  disabled={saving === t.id}
                >
                  <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {t.is_active ? 'Активен' : 'Неактивен'}
                  </Badge>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
