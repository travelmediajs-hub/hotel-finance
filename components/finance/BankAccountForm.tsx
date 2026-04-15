'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { BankAccount } from '@/types/finance'

interface Props {
  trigger: React.ReactNode
  editAccount?: BankAccount | null
  onClose?: () => void
}

const currencyOptions = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
]

const accountTypeOptions = [
  { value: 'CURRENT', label: 'Разплащателна' },
  { value: 'SAVINGS', label: 'Спестовна' },
  { value: 'CREDIT', label: 'Кредитна' },
  { value: 'DEPOSIT', label: 'Депозитна' },
]

const paymentOptions = [
  { value: 'BANK_TRANSFER', label: 'Банков превод' },
  { value: 'CARD', label: 'Карта' },
  { value: 'CASH', label: 'Брой' },
  { value: 'OTHER', label: 'Друго' },
]

export function BankAccountForm({ trigger, editAccount, onClose }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState(editAccount?.currency ?? '')
  const [accountType, setAccountType] = useState(editAccount?.account_type ?? '')
  const [allowedPayments, setAllowedPayments] = useState<string[]>(
    editAccount?.allowed_payments ?? ['BANK_TRANSFER', 'CARD']
  )

  const isEdit = !!editAccount

  useEffect(() => {
    if (editAccount) {
      setCurrency(editAccount.currency)
      setAccountType(editAccount.account_type)
      setAllowedPayments(editAccount.allowed_payments ?? ['BANK_TRANSFER', 'CARD'])
      setOpen(true)
    }
  }, [editAccount])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setError(null)
      onClose?.()
    }
  }

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
      allowed_payments: allowedPayments,
      note: (formData.get('note') as string)?.trim() || null,
    }

    if (!currency || !accountType) {
      setError('Моля, изберете валута и тип на сметката')
      setLoading(false)
      return
    }

    if (allowedPayments.length === 0) {
      setError('Моля, изберете поне един вид плащане')
      setLoading(false)
      return
    }

    try {
      const url = isEdit
        ? `/api/finance/bank-accounts/${editAccount.id}`
        : '/api/finance/bank-accounts'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      handleOpenChange(false)
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEdit && <DialogTrigger render={trigger as React.ReactElement}></DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактирай сметка' : 'Нова банкова сметка'}</DialogTitle>
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
              <Input id="ba-name" name="name" required placeholder="напр. Основна сметка" defaultValue={editAccount?.name ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-iban">IBAN *</Label>
              <Input id="ba-iban" name="iban" required placeholder="BG..." defaultValue={editAccount?.iban ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-bank">Банка *</Label>
              <Input id="ba-bank" name="bank" required placeholder="напр. УниКредит" defaultValue={editAccount?.bank ?? ''} />
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
              <Input id="ba-balance" name="opening_balance" type="number" step="0.01" required defaultValue={editAccount?.opening_balance ?? 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ba-date">Дата на начално салдо *</Label>
              <DateInput id="ba-date" name="opening_balance_date" required defaultValue={editAccount?.opening_balance_date ?? ''} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Видове плащания *</Label>
              <div className="flex flex-wrap gap-4">
                {paymentOptions.map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowedPayments.includes(opt.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedPayments(prev => [...prev, opt.value])
                        } else {
                          setAllowedPayments(prev => prev.filter(v => v !== opt.value))
                        }
                      }}
                      className="rounded border-border"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ba-note">Бележка</Label>
              <Input id="ba-note" name="note" placeholder="Допълнителна информация" defaultValue={editAccount?.note ?? ''} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Отказ
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Запис...' : isEdit ? 'Запази' : 'Създай'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
