'use client'

import { useState } from 'react'
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
import type { BankAccount, Property } from '@/types/finance'

interface Props {
  accounts: BankAccount[]
  properties: Pick<Property, 'id' | 'name'>[]
  trigger: React.ReactNode
}

const directionOptions = [
  { value: 'IN', label: 'Приход (IN)' },
  { value: 'OUT', label: 'Разход (OUT)' },
]

const typeOptions = [
  { value: 'IN_HOTEL', label: 'Внос от хотел' },
  { value: 'IN_POS', label: 'Заверяване от POS' },
  { value: 'IN_OTHER', label: 'Друг приход' },
  { value: 'OUT_INVOICE', label: 'Плащане фактура' },
  { value: 'OUT_CREDIT', label: 'Вноска кредит' },
  { value: 'OUT_REVOLV', label: 'Погасяване revolving' },
  { value: 'OUT_SALARY', label: 'Заплати' },
  { value: 'OUT_TAX', label: 'Данъци' },
  { value: 'OUT_RENT', label: 'Наеми' },
  { value: 'OUT_TRANSFER', label: 'Превод към обект' },
  { value: 'INTER_BANK', label: 'Вътрешен превод' },
]

export function BankTransactionForm({ accounts, properties, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bankAccountId, setBankAccountId] = useState('')
  const [direction, setDirection] = useState('')
  const [txType, setTxType] = useState('')
  const [propertyId, setPropertyId] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!bankAccountId || !direction || !txType) {
      setError('Моля, попълнете всички задължителни полета')
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)
    const body = {
      bank_account_id: bankAccountId,
      transaction_date: (formData.get('transaction_date') as string)?.trim(),
      direction,
      amount: parseFloat(formData.get('amount') as string),
      counterparty: (formData.get('counterparty') as string)?.trim(),
      type: txType,
      property_id: propertyId || null,
      description: (formData.get('description') as string)?.trim() || null,
      note: (formData.get('note') as string)?.trim() || null,
    }

    try {
      const res = await fetch('/api/finance/bank-transactions', {
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
          <DialogTitle>Нова банкова транзакция</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Сметка *</Label>
              <Select value={bankAccountId} onValueChange={(v) => v && setBankAccountId(v)}>
                <SelectTrigger><SelectValue placeholder="Избери сметка" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.iban})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-date">Дата *</Label>
              <DateInput id="tx-date" name="transaction_date" required />
            </div>
            <div className="space-y-2">
              <Label>Посока *</Label>
              <Select value={direction} onValueChange={(v) => v && setDirection(v)}>
                <SelectTrigger><SelectValue placeholder="Избери посока" /></SelectTrigger>
                <SelectContent>
                  {directionOptions.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-amount">Сума *</Label>
              <Input id="tx-amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-counterparty">Контрагент *</Label>
              <Input id="tx-counterparty" name="counterparty" required placeholder="Име на контрагент" />
            </div>
            <div className="space-y-2">
              <Label>Тип транзакция *</Label>
              <Select value={txType} onValueChange={(v) => v && setTxType(v)}>
                <SelectTrigger><SelectValue placeholder="Избери тип" /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Обект</Label>
              <Select value={propertyId} onValueChange={(v) => v && setPropertyId(v)}>
                <SelectTrigger><SelectValue placeholder="Избери обект (незадължително)" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-desc">Описание</Label>
              <Input id="tx-desc" name="description" placeholder="Описание на транзакцията" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tx-note">Бележка</Label>
              <Input id="tx-note" name="note" placeholder="Допълнителна информация" />
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
