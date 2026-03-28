'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { useHiddenAccounts } from '@/lib/finance/useHiddenAccounts'
import type { Expense, DocumentType, PaymentMethod, ExpenseStatus } from '@/types/finance'

export type ExpenseWithJoins = Expense & {
  departments: { name: string }
  properties: { name: string }
  usali_accounts: { code: string; name: string } | null
}

const documentTypeLabels: Record<DocumentType, string> = {
  INVOICE: 'Фактура',
  EXPENSE_ORDER: 'Разходен ордер',
  RECEIPT: 'Касова бележка',
  NO_DOCUMENT: 'Без документ',
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Банков',
  CASH: 'Брой',
  CARD: 'Карта',
  OTHER: 'Друго',
}

const statusLabels: Record<ExpenseStatus, string> = {
  DRAFT: 'Чернова',
  UNPAID: 'Неплатен',
  SENT_TO_CO: 'Към ЦО',
  APPROVED: 'Одобрен',
  PARTIAL: 'Частичен',
  PAID: 'Платен',
  OVERDUE: 'Просрочен',
  REJECTED: 'Отхвърлен',
}

const statusVariants: Record<ExpenseStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  UNPAID: 'default',
  SENT_TO_CO: 'default',
  APPROVED: 'default',
  PARTIAL: 'default',
  PAID: 'outline',
  OVERDUE: 'destructive',
  REJECTED: 'destructive',
}

const selectClass =
  'bg-transparent border border-border rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring'
const inputClass =
  'bg-transparent border border-border rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring'
const inputErrorClass =
  'bg-transparent border border-destructive rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-destructive'

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface NewRowState {
  issue_date: string
  property_id: string

  account_id: string
  supplier: string
  document_type: string
  amount_net: string
  vat_amount: string
  payment_method: string
}

interface NewRowErrors {
  issue_date?: boolean
  property_id?: boolean

  account_id?: boolean
  supplier?: boolean
  document_type?: boolean
  amount_net?: boolean
  payment_method?: boolean
}

interface Props {
  expenses: ExpenseWithJoins[]
  properties: Array<{ id: string; name: string }>
  accounts: Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>
  userRole: string
  defaultPropertyId?: string
}

export function ExpenseSpreadsheet({
  expenses: initialExpenses,
  properties,
  accounts,
  userRole,
  defaultPropertyId,
}: Props) {
  const router = useRouter()
  const today = toDateString(new Date())

  const canCreate = userRole === 'MANAGER' || userRole === 'ADMIN_CO'
  const isCO = userRole === 'ADMIN_CO' || userRole === 'FINANCE_CO'

  const [expenses, setExpenses] = useState<ExpenseWithJoins[]>(initialExpenses)
  const [newRow, setNewRow] = useState<NewRowState>({
    issue_date: today,
    property_id: defaultPropertyId ?? properties[0]?.id ?? '',
    account_id: '',
    supplier: '',
    document_type: '',
    amount_net: '',
    vat_amount: '',
    payment_method: '',
  })
  const [errors, setErrors] = useState<NewRowErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { isHidden } = useHiddenAccounts(newRow.property_id || defaultPropertyId)

  function setField<K extends keyof NewRowState>(key: K, value: NewRowState[K]) {
    setNewRow((prev) => {
      const updated = { ...prev, [key]: value }
      return updated
    })
    setErrors((prev) => ({ ...prev, [key]: false }))
  }

  function validate(): boolean {
    const errs: NewRowErrors = {}
    if (!newRow.issue_date) errs.issue_date = true
    if (isCO && !newRow.property_id) errs.property_id = true
    if (!newRow.account_id) errs.account_id = true
    if (!newRow.supplier.trim()) errs.supplier = true
    if (!newRow.document_type) errs.document_type = true
    if (!newRow.amount_net || parseFloat(newRow.amount_net) <= 0) errs.amount_net = true
    if (!newRow.payment_method) errs.payment_method = true
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave(submit: boolean) {
    if (!validate()) return
    setSaveError(null)
    setLoading(true)

    const amountNet = parseFloat(newRow.amount_net) || 0
    const vatAmount = parseFloat(newRow.vat_amount) || 0

    const body = {
      property_id: newRow.property_id || defaultPropertyId,
      account_id: newRow.account_id,
      supplier: newRow.supplier.trim(),
      document_type: newRow.document_type,
      issue_date: newRow.issue_date,
      due_date: newRow.issue_date,
      amount_net: amountNet,
      vat_amount: vatAmount,
      payment_method: newRow.payment_method,
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
        setSaveError(details ?? data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      const saved = await res.json()

      if (submit) {
        const submitRes = await fetch(`/api/finance/expenses/${saved.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!submitRes.ok) {
          const submitData = await submitRes.json()
          setSaveError(submitData.message ?? submitData.error ?? 'Грешка при изпращане')
          router.push(`/finance/expenses/${saved.id}`)
          return
        }
      }

      // Optimistically add new row to the table
      const property = properties.find((p) => p.id === (newRow.property_id || defaultPropertyId))
      const optimistic: ExpenseWithJoins = {
        ...saved,
        departments: { name: '' },
        properties: { name: property?.name ?? '' },
      }
      setExpenses((prev) => [optimistic, ...prev])

      // Reset new row
      setNewRow({
        issue_date: today,
        property_id: defaultPropertyId ?? properties[0]?.id ?? '',
        account_id: '',
        supplier: '',
        document_type: '',
        amount_net: '',
        vat_amount: '',
        payment_method: '',
      })

      router.refresh()
    } catch {
      setSaveError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const totalNet = expenses.reduce((s, e) => s + e.amount_net, 0)
  const totalVat = expenses.reduce((s, e) => s + e.vat_amount, 0)
  const totalAmount = expenses.reduce((s, e) => s + e.total_amount, 0)

  return (
    <div className="space-y-2">
      {saveError && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded">
          {saveError}
        </p>
      )}

      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Дата</th>
              {isCO && (
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Обект</th>
              )}
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Сметка</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Доставчик</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Документ</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">Нето</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">ДДС</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">Общо</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Плащане</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Статус</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && !canCreate && (
              <tr>
                <td
                  colSpan={isCO ? 10 : 9}
                  className="px-2 py-8 text-center text-muted-foreground"
                >
                  Няма разходи
                </td>
              </tr>
            )}

            {expenses.map((expense) => (
              <tr
                key={expense.id}
                onClick={() => router.push(`/finance/expenses/${expense.id}`)}
                className="border-b border-border hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <td className="px-2 py-1 whitespace-nowrap font-medium">{expense.issue_date}</td>
                {isCO && (
                  <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                    {expense.properties.name}
                  </td>
                )}
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {expense.usali_accounts?.name ?? '—'}
                </td>
                <td className="px-2 py-1 text-muted-foreground max-w-[140px] truncate">
                  {expense.supplier}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {documentTypeLabels[expense.document_type]}
                </td>
                <td className="px-2 py-1 text-right font-mono whitespace-nowrap">
                  {expense.amount_net.toFixed(2)}
                </td>
                <td className="px-2 py-1 text-right font-mono whitespace-nowrap text-muted-foreground">
                  {expense.vat_amount.toFixed(2)}
                </td>
                <td className="px-2 py-1 text-right font-mono whitespace-nowrap">
                  {expense.total_amount.toFixed(2)}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {paymentMethodLabels[expense.payment_method]}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  <Badge variant={statusVariants[expense.status]} className="text-[0.65rem] px-1 py-0">
                    {statusLabels[expense.status]}
                  </Badge>
                </td>
              </tr>
            ))}

            {/* New row */}
            {canCreate && (
              <tr className="border-b border-border bg-primary/5">
                <td className="px-1 py-1">
                  <input
                    type="date"
                    value={newRow.issue_date}
                    onChange={(e) => setField('issue_date', e.target.value)}
                    className={errors.issue_date ? inputErrorClass : inputClass}
                  />
                </td>
                {isCO && (
                  <td className="px-1 py-1 min-w-[110px]">
                    <select
                      value={newRow.property_id}
                      onChange={(e) => setField('property_id', e.target.value)}
                      className={errors.property_id ? inputErrorClass : selectClass}
                    >
                      <option value="">Обект</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="px-1 py-1 min-w-[110px]">
                  <select
                    value={newRow.account_id}
                    onChange={e => setField('account_id', e.target.value)}
                    className="w-full bg-transparent text-xs border-0 focus:ring-1 focus:ring-primary px-1 py-0.5"
                  >
                    <option value="">Сметка...</option>
                    {accounts
                      .filter(a => a.account_type === 'EXPENSE' && a.level === 3 && !isHidden(a.id))
                      .map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </td>
                <td className="px-1 py-1 min-w-[120px]">
                  <input
                    type="text"
                    placeholder="Доставчик"
                    value={newRow.supplier}
                    onChange={(e) => setField('supplier', e.target.value)}
                    className={errors.supplier ? inputErrorClass : inputClass}
                  />
                </td>
                <td className="px-1 py-1 min-w-[110px]">
                  <select
                    value={newRow.document_type}
                    onChange={(e) => setField('document_type', e.target.value)}
                    className={errors.document_type ? inputErrorClass : selectClass}
                  >
                    <option value="">Документ</option>
                    {(Object.keys(documentTypeLabels) as DocumentType[]).map((k) => (
                      <option key={k} value={k}>{documentTypeLabels[k]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1 min-w-[80px]">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={newRow.amount_net}
                    onChange={(e) => setField('amount_net', e.target.value)}
                    className={`${errors.amount_net ? inputErrorClass : inputClass} text-right`}
                  />
                </td>
                <td className="px-1 py-1 min-w-[70px]">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={newRow.vat_amount}
                    onChange={(e) => setField('vat_amount', e.target.value)}
                    className={`${inputClass} text-right`}
                  />
                </td>
                <td className="px-2 py-1 text-right font-mono text-muted-foreground whitespace-nowrap">
                  {((parseFloat(newRow.amount_net) || 0) + (parseFloat(newRow.vat_amount) || 0)).toFixed(2)}
                </td>
                <td className="px-1 py-1 min-w-[90px]">
                  <select
                    value={newRow.payment_method}
                    onChange={(e) => setField('payment_method', e.target.value)}
                    className={errors.payment_method ? inputErrorClass : selectClass}
                  >
                    <option value="">Плащане</option>
                    {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((k) => (
                      <option key={k} value={k}>{paymentMethodLabels[k]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-1 whitespace-nowrap">
                  <div className="flex gap-1">
                    <button
                      disabled={loading}
                      onClick={() => handleSave(false)}
                      className="px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 whitespace-nowrap"
                    >
                      {loading ? '...' : 'Запази'}
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleSave(true)}
                      className="px-2 py-0.5 text-xs rounded border border-border hover:bg-muted disabled:opacity-50 whitespace-nowrap"
                    >
                      {loading ? '...' : 'Изпрати'}
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Totals row */}
            {expenses.length > 0 && (
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td
                  className="px-2 py-1.5 text-muted-foreground text-xs"
                  colSpan={isCO ? 6 : 5}
                >
                  Общо ({expenses.length})
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs">
                  {totalNet.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs text-muted-foreground">
                  {totalVat.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs">
                  {totalAmount.toFixed(2)}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
