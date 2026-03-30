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
import type { BankAccount } from '@/types/finance'

interface Props {
  accounts: BankAccount[]
  trigger: React.ReactNode
}

export function LoanForm({ accounts, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bankAccountId, setBankAccountId] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!bankAccountId) {
      setError('Моля, изберете банкова сметка')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)
    const body = {
      name: (formData.get('name') as string)?.trim(),
      bank: (formData.get('bank') as string)?.trim(),
      principal_amount: parseFloat(formData.get('principal_amount') as string),
      disbursed_amount: (formData.get('disbursed_amount') as string)?.trim()
        ? parseFloat(formData.get('disbursed_amount') as string)
        : undefined,
      interest_rate: parseFloat(formData.get('interest_rate') as string),
      monthly_payment: parseFloat(formData.get('monthly_payment') as string),
      payment_day: parseInt(formData.get('payment_day') as string, 10),
      first_payment_date: (formData.get('first_payment_date') as string)?.trim(),
      last_payment_date: (formData.get('last_payment_date') as string)?.trim(),
      collateral: (formData.get('collateral') as string)?.trim() || null,
      bank_account_id: bankAccountId,
    }

    try {
      const res = await fetch('/api/finance/loans', {
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
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Нов кредит</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan-name">Име *</Label>
              <Input id="loan-name" name="name" required placeholder="напр. Инвестиционен кредит" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-bank">Банка *</Label>
              <Input id="loan-bank" name="bank" required placeholder="напр. УниКредит" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-principal">Главница *</Label>
              <Input id="loan-principal" name="principal_amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-disbursed">Усвоена сума</Label>
              <Input id="loan-disbursed" name="disbursed_amount" type="number" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-rate">Лихва % *</Label>
              <Input id="loan-rate" name="interest_rate" type="number" step="0.01" min="0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-payment">Месечна вноска *</Label>
              <Input id="loan-payment" name="monthly_payment" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-day">Ден на вноска (1-31) *</Label>
              <Input id="loan-day" name="payment_day" type="number" min="1" max="31" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-first">Първа вноска *</Label>
              <Input id="loan-first" name="first_payment_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-last">Последна вноска *</Label>
              <Input id="loan-last" name="last_payment_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label>Банкова сметка *</Label>
              <Select value={bankAccountId} onValueChange={(v) => v && setBankAccountId(v)}>
                <SelectTrigger><SelectValue placeholder="Избери сметка" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.iban})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="loan-collateral">Обезпечение</Label>
              <Input id="loan-collateral" name="collateral" placeholder="Описание на обезпечението" />
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
