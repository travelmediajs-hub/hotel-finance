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
import type { DocumentType, PaymentMethod } from '@/types/finance'
import { useHiddenAccounts } from '@/lib/finance/useHiddenAccounts'

interface UsaliAccount {
  id: string
  code: string
  name: string
  level: number
  account_type: string
  parent_id: string | null
}

const documentTypeOptions: { value: DocumentType; label: string }[] = [
  { value: 'INVOICE', label: 'Фактура' },
  { value: 'EXPENSE_ORDER', label: 'Разходен ордер' },
  { value: 'RECEIPT', label: 'Касова бележка' },
  { value: 'NO_DOCUMENT', label: 'Без документ' },
]

const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Банков превод' },
  { value: 'CASH', label: 'В брой' },
  { value: 'CARD', label: 'С карта' },
  { value: 'OTHER', label: 'Друго' },
]

interface Props {
  propertyId: string
  departments: { id: string; name: string }[]
  accounts: UsaliAccount[]
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function ExpenseForm({ propertyId, departments, accounts }: Props) {
  const router = useRouter()
  const today = toDateString(new Date())
  const { isHidden } = useHiddenAccounts(propertyId)

  const [departmentId, setDepartmentId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [supplierEik, setSupplierEik] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(today)
  const [amountNet, setAmountNet] = useState(0)
  const [vatAmount, setVatAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAmount = amountNet + vatAmount

  async function handleSave(isDraft: boolean) {
    setError(null)

    if (!departmentId || !accountId || !supplier || !documentType || !issueDate || !dueDate || !paymentMethod || amountNet <= 0) {
      setError('Моля, попълнете всички задължителни полета.')
      return
    }

    if (documentType === 'NO_DOCUMENT' && !note.trim()) {
      setError('Бележка е задължителна при липса на документ.')
      return
    }

    setLoading(true)

    const body = {
      property_id: propertyId,
      department_id: departmentId,
      account_id: accountId,
      supplier,
      supplier_eik: supplierEik || null,
      document_type: documentType,
      document_number: documentNumber || null,
      issue_date: issueDate,
      due_date: dueDate,
      amount_net: amountNet,
      vat_amount: vatAmount,
      payment_method: paymentMethod,
      attachment_url: attachmentUrl || null,
      note: note || null,
    }

    try {
      const res = await fetch('/api/finance/expenses', {
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

      if (!isDraft) {
        const submitRes = await fetch(`/api/finance/expenses/${saved.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!submitRes.ok) {
          const submitData = await submitRes.json()
          setError(submitData.message ?? submitData.error ?? 'Грешка при изпращане')
          router.push(`/finance/expenses/${saved.id}`)
          return
        }
      }

      router.push(`/finance/expenses/${saved.id}`)
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
              <Label>Отдел *</Label>
              <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери отдел" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Сметка (USALI) *</Label>
              <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери сметка" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.level === 3 && !isHidden(a.id)).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Доставчик *</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Име на доставчик"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_eik">ЕИК на доставчик</Label>
              <Input
                id="supplier_eik"
                value={supplierEik}
                onChange={(e) => setSupplierEik(e.target.value)}
                placeholder="ЕИК"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Документ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Документ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Тип документ *</Label>
              <Select value={documentType} onValueChange={(v) => v && setDocumentType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери тип" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypeOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_number">Номер на документ</Label>
              <Input
                id="document_number"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Номер"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue_date">Дата на издаване *</Label>
              <Input
                id="issue_date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Падеж *</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Суми */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Суми</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount_net">Нето сума *</Label>
              <Input
                id="amount_net"
                type="number"
                min={0}
                step="0.01"
                value={amountNet || ''}
                onChange={(e) => setAmountNet(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_amount">ДДС</Label>
              <Input
                id="vat_amount"
                type="number"
                min={0}
                step="0.01"
                value={vatAmount || ''}
                onChange={(e) => setVatAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Обща сума</Label>
              <Input
                value={totalAmount.toFixed(2)}
                disabled
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Плащане */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Плащане и допълнителна информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Начин на плащане *</Label>
              <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Избери начин" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="note">
              Бележка{documentType === 'NO_DOCUMENT' ? ' *' : ''}
            </Label>
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
        <Button disabled={loading} onClick={() => handleSave(false)}>
          {loading ? 'Запис...' : 'Изпрати към ЦО'}
        </Button>
        <Button variant="outline" disabled={loading} onClick={() => handleSave(true)}>
          {loading ? 'Запис...' : 'Запази чернова'}
        </Button>
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Отказ
        </Button>
      </div>
    </div>
  )
}
