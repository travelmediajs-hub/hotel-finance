'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface Props {
  trigger: React.ReactNode
}

const currencyOptions = [
  { value: 'BGN', label: 'BGN' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
]

const accountTypeOptions = [
  { value: 'CURRENT', label: 'Разплащателна' },
  { value: 'SAVINGS', label: 'Спестовна' },
  { value: 'CREDIT', label: 'Кредитна' },
  { value: 'DEPOSIT', label: 'Депозитна' },
]

export function BankAccountForm({ trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState('')
  const [accountType, setAccountType] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const body = {
      name: (formData.get('name') as string)?.trim(),
      iban: (formData.get('iban') as string)?.trim(),
      bank: (formData.get('bank') as string)?.trim(),
      currency,
      account_type: accountType,
      opening_balance: parseFloat(formData.get('opening_balance') as string),
      opening_balance_date: (formData.get('opening_balance_date') as string)?.trim(),
      note: (formData.get('note') as string)?.trim() || null,
    }

    if (!currency || !accountType) {
      setError('Моля, изберете валута и тип на сметката')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/finance/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement}></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Нова банкова сметка</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ba-name">Име *</Label>
              <Input id="ba-name" name="name" required placeholder="напр. Основна сметка" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-iban">IBAN *</Label>
              <Input id="ba-iban" name="iban" required placeholder="BG..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-bank">Банка *</Label>
              <Input id="ba-bank" name="bank" required placeholder="напр. УниКредит" />
            </div>
            <div className="space-y-2">
              <Label>Валута *</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger><SelectValue placeholder="Избери валута" /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Тип сметка *</Label>
              <Select value={accountType} onValueChange={(v) => v && setAccountType(v)}>
                <SelectTrigger><SelectValue placeholder="Избери тип" /></SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-balance">Начално салдо *</Label>
              <Input id="ba-balance" name="opening_balance" type="number" step="0.01" required defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-date">Дата на начално салдо *</Label>
              <Input id="ba-date" name="opening_balance_date" type="date" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ba-note">Бележка</Label>
              <Input id="ba-note" name="note" placeholder="Допълнителна информация" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отказ
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Запис...' : 'Създай'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
