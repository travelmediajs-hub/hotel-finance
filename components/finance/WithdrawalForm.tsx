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
import type { WithdrawalPurpose } from '@/types/finance'

const purposeOptions: { value: WithdrawalPurpose; label: string }[] = [
  { value: 'PAY_EXP', label: 'Плащане разход' },
  { value: 'PAY_SAL', label: 'Заплата' },
  { value: 'ADV_EMP', label: 'Аванс служител' },
  { value: 'ADV_OPS', label: 'Аванс оперативен' },
  { value: 'BANK_IN', label: 'Внасяне в банка' },
  { value: 'CASH_TRANS', label: 'Прехвърляне каса' },
  { value: 'CO_COLLECT', label: 'Събиране ЦО' },
  { value: 'OTHER', label: 'Друго' },
]

interface Props {
  propertyId: string
  bankAccounts: { id: string; name: string; iban: string }[]
}

export function WithdrawalForm({ propertyId, bankAccounts }: Props) {
  const router = useRouter()

  const [cashRegister, setCashRegister] = useState('')
  const [amount, setAmount] = useState(0)
  const [withdrawnBy, setWithdrawnBy] = useState('')
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [expenseId, setExpenseId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [targetCash, setTargetCash] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsDescription = purpose === 'ADV_EMP' || purpose === 'ADV_OPS' || purpose === 'OTHER'
  const showExpenseId = purpose === 'PAY_EXP'
  const showEmployeeId = purpose === 'PAY_SAL' || purpose === 'ADV_EMP'
  const showTargetCash = purpose === 'CASH_TRANS'
  const showBankAccountId = purpose === 'BANK_IN'

  async function handleSubmit() {
    setError(null)

    if (!cashRegister || !withdrawnBy || !purpose || amount <= 0) {
      setError('Моля, попълнете всички задължителни полета.')
      return
    }

    if (needsDescription && !description.trim()) {
      setError('Описание е задължително за избраната цел.')
      return
    }

    setLoading(true)

    const body = {
      property_id: propertyId,
      cash_register: cashRegister,
      amount,
      withdrawn_by: withdrawnBy,
      purpose,
      description: description || null,
      expense_id: expenseId || null,
      employee_id: employeeId || null,
      target_cash: targetCash || null,
      bank_account_id: bankAccountId || null,
      attachment_url: attachmentUrl || null,
      note: note || null,
    }

    try {
      const res = await fetch('/api/finance/withdrawals', {
        method: 'POST',
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
      router.push(`/finance/withdrawals/${saved.id}`)
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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
              <Label htmlFor="cash_register">Каса *</Label>
              <Input
                id="cash_register"
                value={cashRegister}
                onChange={(e) => setCashRegister(e.target.value)}
                placeholder="Име на каса"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Сума *</Label>
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
              <Label htmlFor="withdrawn_by">Тегли (три имена) *</Label>
              <Input
                id="withdrawn_by"
                value={withdrawnBy}
                onChange={(e) => setWithdrawnBy(e.target.value)}
                placeholder="Три имена"
              />
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Описание и допълнителни полета */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Допълнителна информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">
                Описание{needsDescription ? ' *' : ''}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание на теглене..."
                rows={3}
              />
            </div>

            {showExpenseId && (
              <div className="space-y-2">
                <Label htmlFor="expense_id">ID на разход</Label>
                <Input
                  id="expense_id"
                  value={expenseId}
                  onChange={(e) => setExpenseId(e.target.value)}
                  placeholder="UUID на разход"
                />
              </div>
            )}

            {showEmployeeId && (
              <div className="space-y-2">
                <Label htmlFor="employee_id">ID на служител</Label>
                <Input
                  id="employee_id"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="UUID на служител"
                />
              </div>
            )}

            {showTargetCash && (
              <div className="space-y-2">
                <Label htmlFor="target_cash">Целева каса</Label>
                <Input
                  id="target_cash"
                  value={targetCash}
                  onChange={(e) => setTargetCash(e.target.value)}
                  placeholder="Име на целева каса"
                />
              </div>
            )}

            {showBankAccountId && (
              <div className="space-y-2">
                <Label>Банкова сметка</Label>
                <Select value={bankAccountId} onValueChange={(v) => v && setBankAccountId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Избери сметка" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(ba => (
                      <SelectItem key={ba.id} value={ba.id}>
                        {ba.name} ({ba.iban})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
          </div>
          <div className="mt-4 space-y-2">
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

      {/* Бутони */}
      <div className="flex gap-3">
        <Button disabled={loading} onClick={handleSubmit}>
          {loading ? 'Запис...' : 'Запиши теглене'}
        </Button>
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Отказ
        </Button>
      </div>
    </div>
  )
}
