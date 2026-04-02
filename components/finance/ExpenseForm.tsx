'use client'

import { useState, useEffect, useRef } from 'react'
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
import type { DocumentType, PaymentMethod, UserRole } from '@/types/finance'
import { useHiddenAccounts } from '@/lib/finance/useHiddenAccounts'
import { Plus } from 'lucide-react'

interface UsaliAccount {
  id: string
  code: string
  name: string
  level: number
  account_type: string
  parent_id: string | null
}

interface SupplierOption {
  id: string
  name: string
  eik: string | null
  vat_number: string | null
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
  accounts: UsaliAccount[]
  suppliers?: SupplierOption[]
  userRole: UserRole
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function ExpenseForm({ propertyId, accounts, suppliers: initialSuppliers, userRole }: Props) {
  const isManager = userRole === 'MANAGER'
  const router = useRouter()
  const today = toDateString(new Date())
  const { isHidden } = useHiddenAccounts(propertyId)

  const [accountId, setAccountId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [supplierEik, setSupplierEik] = useState('')
  const [suppliersList, setSuppliersList] = useState<SupplierOption[]>(initialSuppliers ?? [])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierDropdown, setSupplierDropdown] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const supplierRef = useRef<HTMLDivElement>(null)
  const [documentType, setDocumentType] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(today)
  const [amountNet, setAmountNet] = useState(0)
  const [hasVat, setHasVat] = useState(false)
  const [vatAmount, setVatAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAmount = amountNet + vatAmount

  // Load suppliers if not passed as prop
  useEffect(() => {
    if (initialSuppliers) return
    fetch('/api/finance/suppliers?active_only=true')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSuppliersList(data) })
      .catch(() => {})
  }, [initialSuppliers])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setSupplierDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredSuppliers = suppliersList.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.eik?.includes(supplierSearch) ||
      s.vat_number?.includes(supplierSearch)
  )

  function selectSupplier(s: SupplierOption) {
    setSupplierId(s.id)
    setSupplier(s.name)
    setSupplierEik(s.eik ?? '')
    setSupplierSearch(s.name)
    setSupplierDropdown(false)
  }

  async function createSupplierInline() {
    const name = supplierSearch.trim()
    if (!name) return
    setCreatingSupplier(true)
    try {
      const res = await fetch('/api/finance/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const created = await res.json()
        const opt: SupplierOption = { id: created.id, name: created.name, eik: created.eik, vat_number: created.vat_number }
        setSuppliersList((prev) => [...prev, opt].sort((a, b) => a.name.localeCompare(b.name)))
        selectSupplier(opt)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Грешка при създаване на доставчик')
      }
    } catch {
      setError('Грешка при връзка')
    } finally {
      setCreatingSupplier(false)
    }
  }

  async function handleSave(isDraft: boolean) {
    setError(null)

    if (!accountId || !supplierId || !documentType || !issueDate || !dueDate || !paymentMethod || amountNet <= 0) {
      setError('Моля, попълнете всички задължителни полета.')
      return
    }

    if (documentType === 'NO_DOCUMENT' && !note.trim()) {
      setError('Бележка е задължителна при липса на документ.')
      return
    }

    setLoading(true)

    const body: Record<string, unknown> = {
      property_id: propertyId,
      account_id: accountId,
      supplier_id: supplierId,
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

    // Manager paying cash: mark as paid from property cash register
    if (isManager && paymentMethod === 'CASH') {
      body.paid_from_cash = 'property'
      body.mark_paid = true
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
              <Label>Сметка (USALI) *</Label>
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
            <div className="space-y-2 relative" ref={supplierRef}>
              <Label>Доставчик *</Label>
              <Input
                value={supplierSearch}
                onChange={(e) => {
                  setSupplierSearch(e.target.value)
                  setSupplierDropdown(true)
                  if (!e.target.value.trim()) {
                    setSupplierId('')
                    setSupplier('')
                    setSupplierEik('')
                  }
                }}
                onFocus={() => setSupplierDropdown(true)}
                placeholder="Търсене или добавяне..."
              />
              {supplierDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
                  {filteredSuppliers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between items-center"
                      onClick={() => selectSupplier(s)}
                    >
                      <span>{s.name}</span>
                      {s.eik && <span className="text-xs text-muted-foreground font-mono">{s.eik}</span>}
                    </button>
                  ))}
                  {supplierSearch.trim() && !filteredSuppliers.some((s) => s.name.toLowerCase() === supplierSearch.trim().toLowerCase()) && (
                    <button
                      type="button"
                      disabled={creatingSupplier}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 text-primary flex items-center gap-1.5 border-t"
                      onClick={createSupplierInline}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {creatingSupplier ? 'Създаване...' : `Добави "${supplierSearch.trim()}"`}
                    </button>
                  )}
                  {!supplierSearch.trim() && filteredSuppliers.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Няма доставчици</p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_eik">ЕИК на доставчик</Label>
              <Input
                id="supplier_eik"
                value={supplierEik}
                onChange={(e) => setSupplierEik(e.target.value)}
                placeholder="ЕИК"
                disabled={!!supplierId}
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
              <DateInput
                id="issue_date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Падеж *</Label>
              <DateInput
                id="due_date"
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
                onChange={(e) => {
                  const net = parseFloat(e.target.value) || 0
                  setAmountNet(net)
                  if (hasVat) setVatAmount(Math.round(net * 20) / 100)
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vat_amount">ДДС</Label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasVat}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setHasVat(checked)
                      if (checked) {
                        setVatAmount(Math.round(amountNet * 20) / 100)
                      } else {
                        setVatAmount(0)
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">ДДС 20%</span>
                </label>
              </div>
              <Input
                id="vat_amount"
                type="number"
                min={0}
                step="0.01"
                value={vatAmount || ''}
                onChange={(e) => setVatAmount(parseFloat(e.target.value) || 0)}
                disabled={hasVat}
                className={hasVat ? 'font-mono bg-muted' : ''}
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
              {isManager ? (
                <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Избери начин" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">В брой</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Банков превод</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
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
              )}
              {isManager && paymentMethod === 'CASH' && (
                <p className="text-xs text-green-500">Ще бъде платено от касата на обекта</p>
              )}
              {isManager && paymentMethod === 'BANK_TRANSFER' && (
                <p className="text-xs text-muted-foreground">Ще бъде изпратено към ЦО за плащане</p>
              )}
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
