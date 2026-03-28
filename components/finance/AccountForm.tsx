'use client'

import { useState } from 'react'
import type { UsaliAccount, UsaliDepartmentTemplate } from '@/types/finance'

interface Props {
  templates: UsaliDepartmentTemplate[]
  accounts: UsaliAccount[]
  onClose: () => void
}

export function AccountForm({ templates, accounts, onClose }: Props) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    account_type: 'EXPENSE' as 'REVENUE' | 'EXPENSE',
    level: 3,
    parent_id: null as string | null,
    template_id: '',
    sort_order: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parentOptions = accounts.filter(a => {
    if (form.level === 1) return false
    if (form.level === 2) return a.level === 1
    if (form.level === 3) return a.level === 2
    return false
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/finance/usali-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Грешка при запис')
        return
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 p-4 border rounded-md bg-card">
      <h3 className="text-sm font-medium mb-3">Нова сметка</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground">Код</label>
          <input
            type="text"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
            required
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Наименование</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
            required
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Тип</label>
          <select
            value={form.account_type}
            onChange={e => setForm(f => ({ ...f, account_type: e.target.value as 'REVENUE' | 'EXPENSE' }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          >
            <option value="REVENUE">Приход</option>
            <option value="EXPENSE">Разход</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Ниво</label>
          <select
            value={form.level}
            onChange={e => setForm(f => ({ ...f, level: parseInt(e.target.value), parent_id: null }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          >
            <option value={1}>1 — Група</option>
            <option value={2}>2 — Подгрупа</option>
            <option value={3}>3 — Сметка</option>
          </select>
        </div>
        {form.level > 1 && (
          <div>
            <label className="text-[10px] text-muted-foreground">Родител</label>
            <select
              value={form.parent_id ?? ''}
              onChange={e => setForm(f => ({ ...f, parent_id: e.target.value || null }))}
              className="w-full text-xs bg-background border rounded px-2 py-1.5"
              required
            >
              <option value="">Избери...</option>
              {parentOptions.map(a => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-[10px] text-muted-foreground">Департамент</label>
          <select
            value={form.template_id}
            onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
            required
          >
            <option value="">Избери...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Сортиране</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          />
        </div>

        {error && <p className="col-span-2 text-xs text-destructive">{error}</p>}

        <div className="col-span-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md"
          >
            Отказ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Запис...' : 'Запази'}
          </button>
        </div>
      </form>
    </div>
  )
}
