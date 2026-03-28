'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface Props {
  inTransitId: string
  remainingAmount: number
}

export function InTransitCloseForm({ inTransitId, remainingAmount }: Props) {
  const router = useRouter()

  const [amount, setAmount] = useState(remainingAmount)
  const [destinationType, setDestinationType] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!amount || amount <= 0 || amount > remainingAmount) {
      setError(`Сумата трябва да е между 0.01 и ${remainingAmount.toFixed(2)}.`)
      return
    }
    if (!destinationType) {
      setError('Моля, изберете тип дестинация.')
      return
    }
    if (!destinationId.trim()) {
      setError('Моля, въведете ID на дестинацията.')
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
          destination_id: destinationId.trim(),
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Затваряне на стъпка</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="close_amount">Сума (макс. {remainingAmount.toFixed(2)})</Label>
              <Input
                id="close_amount"
                type="number"
                min={0.01}
                max={remainingAmount}
                step="0.01"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Тип дестинация</Label>
              <Select value={destinationType} onValueChange={(v) => v && setDestinationType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_ACCOUNT">Банкова сметка</SelectItem>
                  <SelectItem value="PROPERTY_CASH">Каса на обект</SelectItem>
                  <SelectItem value="CO_CASH">Каса ЦО</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_id">ID на дестинация</Label>
              <Input
                id="destination_id"
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                placeholder="UUID"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} size="sm">
              {loading ? 'Запис...' : 'Затвори стъпка'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
