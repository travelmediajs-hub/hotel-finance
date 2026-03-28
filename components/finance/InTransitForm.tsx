'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { InTransitSourceType } from '@/types/finance'

const sourceTypeOptions: { value: InTransitSourceType; label: string }[] = [
  { value: 'BANK_ACCOUNT', label: 'Банкова сметка' },
  { value: 'PROPERTY_CASH', label: 'Каса на обект' },
  { value: 'CO_CASH', label: 'Каса ЦО' },
]

interface SourceRow {
  source_type: InTransitSourceType | ''
  source_id: string
  amount: number
  withdrawal_id: string
}

function emptySource(): SourceRow {
  return { source_type: '', source_id: '', amount: 0, withdrawal_id: '' }
}

export function InTransitForm() {
  const router = useRouter()

  const [totalAmount, setTotalAmount] = useState(0)
  const [currency, setCurrency] = useState('EUR')
  const [description, setDescription] = useState('')
  const [sources, setSources] = useState<SourceRow[]>([emptySource()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSource() {
    setSources(prev => [...prev, emptySource()])
  }

  function removeSource(index: number) {
    setSources(prev => prev.filter((_, i) => i !== index))
  }

  function updateSource(index: number, field: keyof SourceRow, value: string | number) {
    setSources(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!totalAmount || totalAmount <= 0) {
      setError('Моля, въведете валидна сума.')
      return
    }
    if (!description.trim()) {
      setError('Моля, въведете описание.')
      return
    }

    const validSources = sources.filter(s => s.source_type && s.source_id.trim() && s.amount > 0)
    if (validSources.length === 0) {
      setError('Моля, добавете поне един валиден източник.')
      return
    }

    setLoading(true)

    const body = {
      total_amount: totalAmount,
      currency,
      description: description.trim(),
      sources: validSources.map(s => ({
        source_type: s.source_type,
        source_id: s.source_id.trim(),
        amount: s.amount,
        withdrawal_id: s.withdrawal_id.trim() || null,
      })),
    }

    try {
      const res = await fetch('/api/finance/in-transits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* Основна информация */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Основна информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_amount">Обща сума *</Label>
              <Input
                id="total_amount"
                type="number"
                min={0.01}
                step="0.01"
                value={totalAmount || ''}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Валута *</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BGN">BGN — Лев</SelectItem>
                  <SelectItem value="EUR">EUR — Евро</SelectItem>
                  <SelectItem value="USD">USD — Долар</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Описание *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание на обръщението..."
                rows={3}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Източници */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Източници</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addSource}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Добави източник
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {sources.map((src, index) => (
            <div key={index}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Тип източник</Label>
                  <Select
                    value={src.source_type}
                    onValueChange={(v) => v && updateSource(index, 'source_type', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Избери тип" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceTypeOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ID на източник</Label>
                  <Input
                    value={src.source_id}
                    onChange={(e) => updateSource(index, 'source_id', e.target.value)}
                    placeholder="UUID на сметката/касата"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Сума</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={src.amount || ''}
                    onChange={(e) => updateSource(index, 'amount', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>ID на теглене (незадълж.)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={src.withdrawal_id}
                      onChange={(e) => updateSource(index, 'withdrawal_id', e.target.value)}
                      placeholder="UUID на теглене"
                    />
                    {sources.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeSource(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Бутони */}
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
