'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { MoneyReceivedPurpose, SourceType, DeliveryMethod } from '@/types/finance'

const purposeOptions: { value: MoneyReceivedPurpose; label: string }[] = [
  { value: 'OPERATIONAL', label: 'Оперативни' },
  { value: 'SALARIES', label: 'Заплати' },
  { value: 'CASH_SUPPLY', label: 'Захранване каса' },
  { value: 'SPECIFIC_GOAL', label: 'Конкретна цел' },
  { value: 'ADVANCE', label: 'Аванс' },
]

const sourceTypeOptions: { value: SourceType; label: string }[] = [
  { value: 'BANK_ACCOUNT', label: 'Банкова сметка' },
  { value: 'CO_CASH', label: 'Каса ЦО' },
  { value: 'OTHER_PROPERTY', label: 'Друг обект' },
  { value: 'OTHER', label: 'Друго' },
]

const deliveryMethodOptions: { value: DeliveryMethod; label: string }[] = [
  { value: 'IN_PERSON', label: 'На ръка' },
  { value: 'COURIER', label: 'Куриер' },
  { value: 'BANK_TRANSFER', label: 'Банков превод' },
]

interface Props {
  properties: { id: string; name: string }[]
  bankAccounts: { id: string; name: string; iban: string }[]
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function MoneyReceivedForm({ properties, bankAccounts }: Props) {
  const router = useRouter()
  const today = toDateString(new Date())

  const [propertyId, setPropertyId] = useState('')
  const [amount, setAmount] = useState(0)
  const [sentDate, setSentDate] = useState(today)
  const [purpose, setPurpose] = useState('')
  const [purposeDescription, setPurposeDescription] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [sourceBankAccountId, setSourceBankAccountId] = useState('')
  const [sourcePropertyId, setSourcePropertyId] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('')
  const [deliveredBy, setDeliveredBy] = useState('')
  const [note, setNote] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showPurposeDescription = purpose === 'SPECIFIC_GOAL' || purpose === 'ADVANCE'
  const showBankAccount = sourceType === 'BANK_ACCOUNT'
  const showSourceProperty = sourceType === 'OTHER_PROPERTY'
  const showDeliveredBy = deliveryMethod === 'IN_PERSON'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!propertyId || amount <= 0 || !sentDate || !purpose || !sourceType || !deliveryMethod) {
      setError('Моля, попълнете всички задължителни полета.')
      return
    }

    if (showBankAccount && !sourceBankAccountId) {
      setError('Моля, изберете банкова сметка.')
      return
    }

    if (showSourceProperty && !sourcePropertyId) {
      setError('Моля, изберете обект-източник.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/finance/money-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          amount,
          sent_date: sentDate,
          purpose,
          purpose_description: purposeDescription || null,
          source_type: sourceType,
          source_bank_account_id: showBankAccount ? sourceBankAccountId : null,
          source_property_id: showSourceProperty ? sourcePropertyId : null,
          delivery_method: deliveryMethod,
          delivered_by: deliveredBy || null,
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

            <div className="space-y-2">
              <Label htmlFor="sent_date">Дата на изпращане *</Label>
              <Input
                id="sent_date"
                type="date"
                value={sentDate}
                onChange={(e) => setSentDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Цел и източник</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Цел *</Label>
              <Select value={purpose} onValueChange={(v) => v && setPurpose(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери цел" />
                </SelectTrigger>
                <SelectContent>
                  {purposeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showPurposeDescription && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="purpose_description">Описание на целта</Label>
                <Input
                  id="purpose_description"
                  value={purposeDescription}
                  onChange={(e) => setPurposeDescription(e.target.value)}
                  placeholder="Опишете конкретната цел..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Тип източник *</Label>
              <Select value={sourceType} onValueChange={(v) => {
                if (v) {
                  setSourceType(v)
                  setSourceBankAccountId('')
                  setSourcePropertyId('')
                }
              }}>
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

            {showBankAccount && (
              <div className="space-y-2">
                <Label>Банкова сметка *</Label>
                <Select value={sourceBankAccountId} onValueChange={(v) => v && setSourceBankAccountId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Избери сметка" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(ba => (
                      <SelectItem key={ba.id} value={ba.id}>
                        {ba.name} – {ba.iban}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showSourceProperty && (
              <div className="space-y-2">
                <Label>Обект-източник *</Label>
                <Select value={sourcePropertyId} onValueChange={(v) => v && setSourcePropertyId(v)}>
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
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Начин на доставка</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Метод на доставка *</Label>
              <Select value={deliveryMethod} onValueChange={(v) => {
                if (v) {
                  setDeliveryMethod(v)
                  if (v !== 'IN_PERSON') setDeliveredBy('')
                }
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери метод" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryMethodOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showDeliveredBy && (
              <div className="space-y-2">
                <Label htmlFor="delivered_by">Доставено от</Label>
                <Input
                  id="delivered_by"
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  placeholder="Име на куриера/лицето"
                />
              </div>
            )}
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
