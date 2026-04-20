'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Property } from '@/types/finance'

const propertyTypes = [
  { value: 'HOTEL', label: 'Хотел' },
  { value: 'APARTMENT_HOTEL', label: 'Апарт хотел' },
  { value: 'HOSTEL', label: 'Хостел' },
  { value: 'SHOP', label: 'Магазин' },
  { value: 'OTHER', label: 'Друг' },
]

const categoryOptions = [
  { value: '1_STAR', label: '1 звезда' },
  { value: '2_STAR', label: '2 звезди' },
  { value: '3_STAR', label: '3 звезди' },
  { value: '4_STAR', label: '4 звезди' },
  { value: '5_STAR', label: '5 звезди' },
  { value: 'NONE', label: 'Без категория' },
]

const statusOptions = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'INACTIVE', label: 'Неактивен' },
]

interface Props {
  property?: Property
}

export function PropertyForm({ property }: Props) {
  const router = useRouter()
  const isEdit = !!property
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState(property?.type ?? '')
  const [category, setCategory] = useState(property?.category ?? '')
  const [status, setStatus] = useState(property?.status ?? 'ACTIVE')
  const [roomsMain, setRoomsMain] = useState(property?.rooms_main ?? 0)
  const [roomsAnnex, setRoomsAnnex] = useState(property?.rooms_annex ?? 0)
  const [totalBeds, setTotalBeds] = useState(property?.total_beds ?? 0)
  const [annualRent, setAnnualRent] = useState(property?.annual_rent ?? 0)
  const [operatingMonths, setOperatingMonths] = useState<number[]>(
    property?.operating_months ?? [1,2,3,4,5,6,7,8,9,10,11,12]
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {}

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string' && value.trim() !== '') {
        body[key] = value.trim()
      }
    }

    // Select values are tracked via state (base-ui Select doesn't set FormData)
    if (type) body.type = type
    if (category) body.category = category
    if (isEdit && status) body.status = status

    body.rooms_main = roomsMain
    body.rooms_annex = roomsAnnex
    body.total_beds = totalBeds
    body.annual_rent = annualRent
    body.operating_months = operatingMonths

    try {
      const url = isEdit
        ? `/api/finance/properties/${property.id}`
        : '/api/finance/properties'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

      const saved = await res.json()
      if (isEdit) {
        router.refresh()
      } else {
        router.push(`/finance/properties/${saved.id}`)
      }
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {isEdit ? 'Редактиране на обект' : 'Нов обект'}
        </CardTitle>
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
              <Label htmlFor="name">Име *</Label>
              <Input id="name" name="name" required defaultValue={property?.name ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Тип *</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger><SelectValue placeholder="Избери тип" /></SelectTrigger>
                <SelectContent>
                  {propertyTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория *</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger><SelectValue placeholder="Избери категория" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Град *</Label>
              <Input id="city" name="city" required defaultValue={property?.city ?? ''} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Адрес *</Label>
              <Input id="address" name="address" required defaultValue={property?.address ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" name="phone" defaultValue={property?.phone ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={property?.email ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eik">ЕИК *</Label>
              <Input id="eik" name="eik" required pattern="\d{9}" maxLength={9}
                defaultValue={property?.eik ?? ''} placeholder="123456789" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat_number">ДДС номер</Label>
              <Input id="vat_number" name="vat_number" defaultValue={property?.vat_number ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mol">МОЛ *</Label>
              <Input id="mol" name="mol" required defaultValue={property?.mol ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" name="iban" defaultValue={property?.iban ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank">Банка</Label>
              <Input id="bank" name="bank" defaultValue={property?.bank ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager_id">Управител (ID) *</Label>
              <Input id="manager_id" name="manager_id" required
                defaultValue={property?.manager_id ?? ''} placeholder="UUID на управител" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="authorized_person_id">Упълномощено лице (ID)</Label>
              <Input id="authorized_person_id" name="authorized_person_id"
                defaultValue={property?.authorized_person_id ?? ''} placeholder="UUID (незадължително)" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="active_since">Активен от *</Label>
              <DateInput id="active_since" name="active_since" required
                defaultValue={property?.active_since ?? ''} />
            </div>

            {isEdit && (
              <div className="space-y-2">
                <Label htmlFor="status">Статус</Label>
                <Select value={status} onValueChange={(v) => v && setStatus(v as 'ACTIVE' | 'INACTIVE')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rooms_main">Брой стаи (основна сграда)</Label>
              <Input id="rooms_main" type="number" min={0} value={roomsMain}
                onChange={e => setRoomsMain(parseInt(e.target.value) || 0)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rooms_annex">Брой стаи (анекс)</Label>
              <Input id="rooms_annex" type="number" min={0} value={roomsAnnex}
                onChange={e => setRoomsAnnex(parseInt(e.target.value) || 0)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_beds">Общ брой легла</Label>
              <Input id="total_beds" type="number" min={0} value={totalBeds}
                onChange={e => setTotalBeds(parseInt(e.target.value) || 0)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="annual_rent">Годишен наем (EUR)</Label>
              <Input id="annual_rent" type="number" min={0} step="0.01" value={annualRent}
                onChange={e => setAnnualRent(parseFloat(e.target.value) || 0)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Работни месеци</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {['Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек'].map((name, idx) => {
                  const m = idx + 1
                  const active = operatingMonths.includes(m)
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => {
                        setOperatingMonths(prev =>
                          prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b)
                        )
                      }}
                      className={cn(
                        'px-2 py-1 text-xs border rounded',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
                      )}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Запис...' : isEdit ? 'Запази' : 'Създай обект'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Отказ
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
