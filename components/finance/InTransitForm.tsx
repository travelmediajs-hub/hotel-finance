'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InTransitSourceType } from '@/types/finance'

type LocType = InTransitSourceType | ''

interface Props {
  bankAccounts: { id: string; name: string; iban: string }[]
  coCash: { id: string; name: string }[]
  properties: { id: string; name: string }[]
  users: { id: string; full_name: string }[]
}

const selectCls = 'bg-transparent border border-border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-ring [&_option]:bg-zinc-900 [&_option]:text-zinc-100'

function getOptions(
  type: LocType,
  bankAccounts: Props['bankAccounts'],
  coCash: Props['coCash'],
  properties: Props['properties'],
) {
  switch (type) {
    case 'BANK_ACCOUNT':
      return bankAccounts.map(a => ({ id: a.id, label: `${a.name} (${a.iban})` }))
    case 'CO_CASH':
      return coCash.map(c => ({ id: c.id, label: c.name }))
    case 'PROPERTY_CASH':
      return properties.map(p => ({ id: p.id, label: p.name }))
    default:
      return []
  }
}

export function InTransitForm({ bankAccounts, coCash, properties, users }: Props) {
  const router = useRouter()

  const [sourceType, setSourceType] = useState<LocType>('')
  const [sourceId, setSourceId] = useState('')
  const [destType, setDestType] = useState<LocType>('')
  const [destId, setDestId] = useState('')
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState('EUR')
  const [carrierId, setCarrierId] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!sourceType) { setError('Изберете откъде тръгват парите.'); return }
    if (!sourceId) { setError('Изберете конкретния източник.'); return }
    if (!destType) { setError('Изберете къде отиват парите.'); return }
    if (!destId) { setError('Изберете конкретната дестинация.'); return }
    if (!amount || amount <= 0) { setError('Въведете валидна сума.'); return }
    if (!carrierId) { setError('Изберете кой носи парите.'); return }
    if (!description.trim()) { setError('Въведете описание.'); return }

    setLoading(true)

    try {
      const res = await fetch('/api/finance/in-transits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_amount: amount,
          currency,
          description: description.trim(),
          carried_by_id: carrierId,
          sources: [{
            source_type: sourceType,
            source_id: sourceId,
            amount,
          }],
          destination: {
            destination_type: destType,
            destination_id: destId,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      router.push('/finance/in-transit')
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const sourceOptions = getOptions(sourceType, bankAccounts, coCash, properties)
  const destOptions = getOptions(destType, bankAccounts, coCash, properties)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Откъде</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Тип *</Label>
              <select
                value={sourceType}
                onChange={e => { setSourceType(e.target.value as LocType); setSourceId('') }}
                className={selectCls}
              >
                <option value="">— изберете —</option>
                <option value="BANK_ACCOUNT">Банкова сметка</option>
                <option value="CO_CASH">Каса ЦО</option>
                <option value="PROPERTY_CASH">Каса на обект</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Конкретно *</Label>
              <select
                value={sourceId}
                onChange={e => setSourceId(e.target.value)}
                className={selectCls}
                disabled={!sourceType}
              >
                <option value="">— изберете —</option>
                {sourceOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Накъде</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Тип *</Label>
              <select
                value={destType}
                onChange={e => { setDestType(e.target.value as LocType); setDestId('') }}
                className={selectCls}
              >
                <option value="">— изберете —</option>
                <option value="BANK_ACCOUNT">Банкова сметка</option>
                <option value="CO_CASH">Каса ЦО</option>
                <option value="PROPERTY_CASH">Каса на обект</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Конкретно *</Label>
              <select
                value={destId}
                onChange={e => setDestId(e.target.value)}
                className={selectCls}
                disabled={!destType}
              >
                <option value="">— изберете —</option>
                {destOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Сума *</Label>
              <Input
                type="number" min={0.01} step="0.01"
                value={amount || ''}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Валута *</Label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectCls}>
                <option value="EUR">EUR — Евро</option>
                <option value="USD">USD — Долар</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Кой носи парите *</Label>
              <select
                value={carrierId}
                onChange={e => setCarrierId(e.target.value)}
                className={selectCls}
              >
                <option value="">— изберете —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Описание *</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="напр. Пренос на пари от хотела към банка..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Запис...' : 'Запиши трансфер'}
        </Button>
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Отказ
        </Button>
      </div>
    </form>
  )
}
