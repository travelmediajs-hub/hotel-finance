'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { fmtDate } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Pencil } from 'lucide-react'
import type { PropertyCashBalance, CashMovement } from '@/types/finance'

interface Props {
  properties: { id: string; name: string }[]
  balances: PropertyCashBalance[]
  canEdit: boolean
  defaultPropertyId?: string
}

const typeLabels: Record<string, string> = {
  daily_report: 'Дневен отчет',
  withdrawal: 'Теглене',
  cash_collection: 'Инкасация',
  money_received: 'Получени средства',
  transfer_in: 'Входящ трансфер',
  transfer_out: 'Изходящ трансфер',
}

const typeBadgeVariants: Record<string, string> = {
  daily_report: 'bg-green-600/20 text-green-400 border-green-600/30',
  withdrawal: 'bg-red-600/20 text-red-400 border-red-600/30',
  cash_collection: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  money_received: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  transfer_in: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  transfer_out: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
}

function fmt(n: number | null) {
  if (n === null || n === 0) return '—'
  return n.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CashRegisterView({ properties, balances, canEdit, defaultPropertyId }: Props) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? '')
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Edit sheet state
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ opening_balance: '', opening_balance_date: '', name: '' })
  const [saving, setSaving] = useState(false)

  const balance = balances.find(b => b.property_id === propertyId)

  const loadMovements = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ property_id: propertyId })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/finance/cash-register?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [propertyId, from, to])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  function openEdit() {
    if (!balance) return
    setEditForm({
      opening_balance: String(balance.opening_balance),
      opening_balance_date: balance.opening_balance_date,
      name: balance.name,
    })
    setEditOpen(true)
  }

  async function handleSave() {
    if (!balance) return
    setSaving(true)
    try {
      const res = await fetch(`/api/finance/cash-register/${balance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_balance: parseFloat(editForm.opening_balance) || 0,
          opening_balance_date: editForm.opening_balance_date,
          name: editForm.name,
        }),
      })
      if (res.ok) {
        setEditOpen(false)
        window.location.reload()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Каса</CardTitle>
            {properties.length > 1 && (
              <Select value={propertyId} onValueChange={(v) => v && setPropertyId(v)}>
                <SelectTrigger className="w-[250px] h-8 text-sm">
                  <SelectValue placeholder="Изберете обект" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Balance display */}
          {balance && (
            <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{balance.name}</p>
                <p className={`text-2xl font-bold ${balance.current_balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {fmt(balance.current_balance)} лв.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Начално салдо: {fmt(balance.opening_balance)} лв. от {fmtDate(balance.opening_balance_date)}
                </p>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Редакция
                </Button>
              )}
            </div>
          )}

          {!balance && propertyId && (
            <p className="text-sm text-muted-foreground mb-4">Няма каса за този обект</p>
          )}

          {/* Date filters */}
          <div className="flex items-end gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">От</Label>
              <DateInput
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="h-8 text-sm w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">До</Label>
              <DateInput
                value={to}
                onChange={e => setTo(e.target.value)}
                className="h-8 text-sm w-[150px]"
              />
            </div>
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>
                Изчисти
              </Button>
            )}
          </div>

          {/* Movements table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium w-[100px]">Дата</th>
                  <th className="text-left px-3 py-2 font-medium w-[140px]">Тип</th>
                  <th className="text-left px-3 py-2 font-medium">Описание</th>
                  <th className="text-right px-3 py-2 font-medium w-[110px]">Приход</th>
                  <th className="text-right px-3 py-2 font-medium w-[110px]">Разход</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Зареждане...</td></tr>
                )}
                {!loading && movements.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Няма движения</td></tr>
                )}
                {!loading && movements.map((m, i) => (
                  <tr key={`${m.reference_id}-${i}`} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{fmtDate(m.date)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeBadgeVariants[m.type] ?? ''}`}>
                        {typeLabels[m.type] ?? m.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{m.description}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-500">{m.income ? fmt(m.income) : ''}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-500">{m.expense ? fmt(m.expense) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit opening balance sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>Редакция на каса</SheetTitle>
            <SheetDescription>Променете началното салдо и датата</SheetDescription>
          </SheetHeader>
          <div className="px-4 space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Име</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Начално салдо</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.opening_balance}
                onChange={e => setEditForm(f => ({ ...f, opening_balance: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Дата на начално салдо</Label>
              <DateInput
                value={editForm.opening_balance_date}
                onChange={e => setEditForm(f => ({ ...f, opening_balance_date: e.target.value }))}
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
