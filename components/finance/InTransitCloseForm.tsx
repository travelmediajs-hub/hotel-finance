'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DestType = 'BANK_ACCOUNT' | 'CO_CASH' | 'PROPERTY_CASH'

interface Props {
  inTransitId: string
  remainingAmount: number
  bankAccounts: { id: string; name: string; iban: string }[]
  coCash: { id: string; name: string }[]
  properties: { id: string; name: string }[]
}

const selectCls = 'bg-transparent border border-border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-ring [&_option]:bg-zinc-900 [&_option]:text-zinc-100'

export function InTransitCloseForm({ inTransitId, remainingAmount, bankAccounts, coCash, properties }: Props) {
  const router = useRouter()

  const [amount, setAmount] = useState(remainingAmount)
  const [destinationType, setDestinationType] = useState<DestType | ''>('')
  const [destinationId, setDestinationId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function getDestOptions() {
    switch (destinationType) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!amount || amount <= 0 || amount > remainingAmount) {
      setError(`Сумата трябва да е между 0.01 и ${remainingAmount.toFixed(2)}.`)
      return
    }
    if (!destinationType) {
      setError('Изберете къде отиват парите.')
      return
    }
    if (!destinationId) {
      setError('Изберете конкретната дестинация.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/finance/in-transits/${inTransitId}/close-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          destination_type: destinationType,
          destination_id: destinationId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при затваряне')
        return
      }

      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const destOptions = getDestOptions()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Приключване (доставяне на пари)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Къде отиват парите *</Label>
              <select
                value={destinationType}
                onChange={e => { setDestinationType(e.target.value as DestType); setDestinationId('') }}
                className={selectCls}
              >
                <option value="">— изберете —</option>
                <option value="BANK_ACCOUNT">Банкова сметка</option>
                <option value="CO_CASH">Каса ЦО</option>
                <option value="PROPERTY_CASH">Каса на обект</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Дестинация *</Label>
              <select
                value={destinationId}
                onChange={e => setDestinationId(e.target.value)}
                className={selectCls}
                disabled={!destinationType}
              >
                <option value="">— изберете —</option>
                {destOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label>Сума (макс. {remainingAmount.toFixed(2)}) *</Label>
            <Input
              type="number"
              min={0.01}
              max={remainingAmount}
              step="0.01"
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} size="sm">
              {loading ? 'Запис...' : 'Приключи'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
