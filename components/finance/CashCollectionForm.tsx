'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface Props {
  properties: { id: string; name: string }[]
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function CashCollectionForm({ properties }: Props) {
  const router = useRouter()
  const today = toDateString(new Date())

  const [propertyId, setPropertyId] = useState('')
  const [collectionDate, setCollectionDate] = useState(today)
  const [amount, setAmount] = useState(0)
  const [coversDateFrom, setCoversDateFrom] = useState(today)
  const [coversDateTo, setCoversDateTo] = useState(today)
  const [note, setNote] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!propertyId || !collectionDate || amount <= 0 || !coversDateFrom || !coversDateTo) {
      setError('Моля, попълнете всички задължителни полета.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/finance/cash-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          collection_date: collectionDate,
          amount,
          covers_date_from: coversDateFrom,
          covers_date_to: coversDateTo,
          note: note || null,
          attachment_url: attachmentUrl || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        const details = data.details?.fieldErrors
          ? Object.entries(data.details.fieldErrors)
              .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
              .join(' | ')
          : null
        setError(details ?? data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      router.push('/finance/cash-flow')
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Основна информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Обект *</Label>
              <Select value={propertyId} onValueChange={(v) => v && setPropertyId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери обект" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection_date">Дата на събиране *</Label>
              <DateInput
                id="collection_date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Сума (€) *</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Обхванат период</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="covers_date_from">От дата *</Label>
              <DateInput
                id="covers_date_from"
                value={coversDateFrom}
                onChange={(e) => setCoversDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="covers_date_to">До дата *</Label>
              <DateInput
                id="covers_date_to"
                value={coversDateTo}
                onChange={(e) => setCoversDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Допълнителна информация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="attachment_url">Прикачен файл (URL)</Label>
            <Input
              id="attachment_url"
              type="url"
              placeholder="https://..."
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Бележка</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Допълнителна информация..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Запис...' : 'Запази'}
        </Button>
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Отказ
        </Button>
      </div>
    </form>
  )
}
