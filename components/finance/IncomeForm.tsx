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
import type { IncomeEntryType, IncomePaymentMethod } from '@/types/finance'
import { useHiddenAccounts } from '@/lib/finance/useHiddenAccounts'

interface UsaliAccount {
  id: string
  code: string
  name: string
  level: number
  account_type: string
  parent_id: string | null
}

const typeOptions: { value: IncomeEntryType; label: string }[] = [
  { value: 'INC_BANK', label: 'Банков приход' },
  { value: 'INC_CASH', label: 'Приход в брой' },
  { value: 'INC_CREDIT_NOTE', label: 'Кредитно известие' },
  { value: 'INC_ADV', label: 'Аванс' },
  { value: 'INC_DEP', label: 'Депозит' },
  { value: 'INC_OTHER', label: 'Друг приход' },
  { value: 'CF_CREDIT', label: 'Усвояване на кредит' },
  { value: 'CF_TRANSFER', label: 'Вътрешен трансфер' },
]

interface InitialEntry {
  id: string
  entry_date: string
  property_id: string
  type: string
  amount: number
  payment_method: string
  payer: string
  account_id: string | null
  bank_account_id: string | null
  loan_id: string | null
  period_from: string | null
  period_to: string | null
  description: string | null
  attachment_url: string | null
}

interface Props {
  properties: { id: string; name: string }[]
  bankAccounts: { id: string; name: string; iban: string }[]
  loans: { id: string; name: string }[]
  accounts: UsaliAccount[]
  entry?: InitialEntry
  onSuccess?: () => void
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function IncomeForm({ properties, bankAccounts, loans, accounts, entry, onSuccess }: Props) {
  const router = useRouter()
  const today = toDateString(new Date())
  const isEdit = !!entry

  const [entryDate, setEntryDate] = useState(entry?.entry_date ?? today)
  const [propertyId, setPropertyId] = useState(entry?.property_id ?? '')
  const [type, setType] = useState(entry?.type ?? '')
  // Display value is always positive — server applies the sign based on type.
  const [amount, setAmount] = useState(Math.abs(entry?.amount ?? 0))
  const [paymentMethod, setPaymentMethod] = useState(entry?.payment_method ?? '')
  const [payer, setPayer] = useState(entry?.payer ?? '')
  const [accountId, setAccountId] = useState(entry?.account_id ?? '')
  const { isHidden } = useHiddenAccounts(propertyId || undefined)
  const [bankAccountId, setBankAccountId] = useState(entry?.bank_account_id ?? '')
  const [loanId, setLoanId] = useState(entry?.loan_id ?? '')
  const [periodFrom, setPeriodFrom] = useState(entry?.period_from ?? '')
  const [periodTo, setPeriodTo] = useState(entry?.period_to ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [attachmentUrl, setAttachmentUrl] = useState(entry?.attachment_url ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showCategory = type.startsWith('INC_')
  const showBankAccount = paymentMethod === 'BANK'
  const showLoan = type === 'CF_CREDIT'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!entryDate || !propertyId || !type || !paymentMethod || !payer.trim() || amount <= 0 || !accountId) {
      setError('Моля, попълнете всички задължителни полета. Сумата трябва да е положителна.')
      return
    }

    setLoading(true)

    const body = {
      entry_date: entryDate,
      property_id: propertyId,
      type,
      amount,
      payment_method: paymentMethod,
      payer: payer.trim(),
      account_id: accountId || null,
      bank_account_id: showBankAccount && bankAccountId ? bankAccountId : null,
      loan_id: showLoan && loanId ? loanId : null,
      period_from: periodFrom || null,
      period_to: periodTo || null,
      description: description.trim() || null,
      attachment_url: attachmentUrl.trim() || null,
    }

    try {
      const url = isEdit ? `/api/finance/income/${entry!.id}` : '/api/finance/income'
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

      if (onSuccess) {
        onSuccess()
        router.refresh()
      } else {
        router.push(isEdit ? `/finance/income/${entry!.id}` : '/finance/income')
        router.refresh()
      }
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
              <Label htmlFor="entry_date">Дата *</Label>
              <DateInput
                id="entry_date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>

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
              <Label>Тип *</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери тип" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Сума * {type === 'INC_CREDIT_NOTE' && <span className="text-xs text-amber-500">(КИ — въведи положително число)</span>}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Начин на плащане *</Label>
              <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери начин" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Банка</SelectItem>
                  <SelectItem value="CASH">В брой</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payer">Платец *</Label>
              <Input
                id="payer"
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                placeholder="Наименование на платеца"
                required
              />
            </div>

            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label>Сметка (USALI)</Label>
                <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Избери сметка" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.level === 3 && !isHidden(a.id)).map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showBankAccount && (
              <div className="space-y-2">
                <Label>Банкова сметка</Label>
                <Select value={bankAccountId} onValueChange={(v) => v && setBankAccountId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Избери сметка" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.iban}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showLoan && (
              <div className="space-y-2">
                <Label>Кредит</Label>
                <Select value={loanId} onValueChange={(v) => v && setLoanId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Избери кредит" />
                  </SelectTrigger>
                  <SelectContent>
                    {loans.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Период */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Период (незадължително)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period_from">От дата</Label>
              <DateInput
                id="period_from"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_to">До дата</Label>
              <DateInput
                id="period_to"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Допълнителна информация */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Допълнителна информация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Забележка</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Допълнителна забележка..."
              rows={3}
            />
          </div>
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
