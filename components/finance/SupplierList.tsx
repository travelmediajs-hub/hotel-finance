'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from '@/components/ui/sheet'
import { Plus, Pencil } from 'lucide-react'

interface Supplier {
  id: string
  name: string
  eik: string | null
  vat_number: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  iban: string | null
  notes: string | null
  is_active: boolean
}

interface Props {
  suppliers: Supplier[]
  canManage: boolean
}

const emptyForm = {
  name: '',
  eik: '',
  vat_number: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  iban: '',
  notes: '',
}

export function SupplierList({ suppliers: initial, canManage }: Props) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState(initial)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.eik?.includes(search) ||
    s.vat_number?.includes(search) ||
    s.contact_person?.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setEditId(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditId(s.id)
    setForm({
      name: s.name,
      eik: s.eik ?? '',
      vat_number: s.vat_number ?? '',
      contact_person: s.contact_person ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      iban: s.iban ?? '',
      notes: s.notes ?? '',
    })
    setError(null)
    setDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Името е задължително')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const payload = {
        name: form.name,
        eik: form.eik || null,
        vat_number: form.vat_number || null,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        iban: form.iban || null,
        notes: form.notes || null,
      }

      if (editId) {
        const res = await fetch(`/api/finance/suppliers/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Грешка при запис')
          return
        }
        const updated = await res.json()
        setSuppliers((prev) => prev.map((s) => (s.id === editId ? { ...s, ...updated } : s)))
      } else {
        const res = await fetch('/api/finance/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Грешка при запис')
          return
        }
        router.refresh()
      }
      setDrawerOpen(false)
    } catch {
      setError('Грешка при връзка')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: Supplier) {
    const res = await fetch(`/api/finance/suppliers/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    })
    if (res.ok) {
      setSuppliers((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x))
      )
    }
  }

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Input
          placeholder="Търсене по име, ЕИК, ДДС..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm h-8 text-sm"
        />
        {canManage && (
          <Button size="sm" onClick={openNew} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" /> Нов доставчик
          </Button>
        )}
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2 font-medium">Име</th>
              <th className="text-left px-3 py-2 font-medium">ЕИК</th>
              <th className="text-left px-3 py-2 font-medium">ДДС номер</th>
              <th className="text-left px-3 py-2 font-medium">Контакт</th>
              <th className="text-left px-3 py-2 font-medium">Телефон</th>
              <th className="text-left px-3 py-2 font-medium">Имейл</th>
              <th className="text-center px-3 py-2 font-medium">Статус</th>
              {canManage && <th className="px-3 py-2 w-10" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="px-3 py-6 text-center text-muted-foreground">
                  {search ? 'Няма намерени доставчици' : 'Няма добавени доставчици'}
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="border-b hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{s.eik ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{s.vat_number ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.contact_person ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.email ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  {canManage ? (
                    <button onClick={() => toggleActive(s)}>
                      <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {s.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {s.is_active ? 'Активен' : 'Неактивен'}
                    </Badge>
                  )}
                </td>
                {canManage && (
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1 hover:bg-muted rounded text-muted-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>{editId ? 'Редакция на доставчик' : 'Нов доставчик'}</SheetTitle>
            <SheetDescription>
              {editId ? 'Променете данните и натиснете Запази' : 'Попълнете данните за новия доставчик'}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 space-y-4 mt-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm">Име на фирма *</Label>
              <Input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="ООД / ЕООД / ЕТ..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">ЕИК (Булстат)</Label>
                <Input
                  value={form.eik}
                  onChange={(e) => setField('eik', e.target.value)}
                  placeholder="123456789"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ДДС номер</Label>
                <Input
                  value={form.vat_number}
                  onChange={(e) => setField('vat_number', e.target.value)}
                  placeholder="BG123456789"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Контактно лице</Label>
              <Input
                value={form.contact_person}
                onChange={(e) => setField('contact_person', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Телефон</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+359..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Имейл</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Адрес</Label>
              <Input
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">IBAN</Label>
              <Input
                value={form.iban}
                onChange={(e) => setField('iban', e.target.value)}
                placeholder="BG..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Бележки</Label>
              <Input
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button disabled={saving} onClick={handleSave} className="w-full">
              {saving ? 'Запис...' : 'Запази'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
