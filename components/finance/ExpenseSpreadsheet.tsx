'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { FilterSelect } from '@/components/finance/FilterSelect'
import { useHiddenAccounts } from '@/lib/finance/useHiddenAccounts'
import { DateInput } from '@/components/ui/date-input'
import { Pencil } from 'lucide-react'
import { fmtDate } from '@/lib/utils'
import type { Expense, DocumentType, PaymentMethod, ExpenseStatus } from '@/types/finance'

export type ExpenseWithJoins = Expense & {
  departments: { name: string } | null
  properties: { name: string }
  usali_accounts: { code: string; name: string } | null
  suppliers: { name: string } | null
  bank_accounts: { name: string } | null
  co_cash: { name: string } | null
}

const documentTypeLabels: Record<DocumentType, string> = {
  INVOICE: 'Фактура',
  CREDIT_NOTE: 'КИ',
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
  RETURNED: 'Върнат',
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
  RETURNED: 'secondary',
}

const selectClass =
  'bg-transparent border border-border rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring [&_option]:bg-zinc-900 [&_option]:text-zinc-100'
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
  supplier_id: string
  document_type: string
  document_number: string
  amount_net: string
  has_vat: boolean
  vat_amount: string
  payment_method: string
  payment_source_id: string
}

interface NewRowErrors {
  issue_date?: boolean
  property_id?: boolean
  account_id?: boolean
  supplier_id?: boolean
  document_type?: boolean
  document_number?: boolean
  amount_net?: boolean
  payment_method?: boolean
  payment_source_id?: boolean
}

type PaymentSource = {
  id: string
  name: string
  type: 'bank' | 'cash'
  allowed_payments: string[]
}

interface Props {
  expenses: ExpenseWithJoins[]
  properties: Array<{ id: string; name: string }>
  accounts: Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>
  suppliers: Array<{ id: string; name: string; eik: string | null }>
  bankAccounts: Array<{ id: string; name: string; iban: string; allowed_payments: string[] }>
  coCash: Array<{ id: string; name: string; allowed_payments: string[] }>
  userRole: string
  defaultPropertyId?: string
}

export function ExpenseSpreadsheet({
  expenses: initialExpenses,
  properties,
  accounts,
  suppliers,
  bankAccounts,
  coCash,
  userRole,
  defaultPropertyId,
}: Props) {
  const router = useRouter()
  const today = toDateString(new Date())

  const canCreate = userRole === 'MANAGER' || userRole === 'ADMIN_CO' || userRole === 'FINANCE_CO'
  const isCO = userRole === 'ADMIN_CO' || userRole === 'FINANCE_CO'
  const [expenses, setExpenses] = useState<ExpenseWithJoins[]>(initialExpenses ?? [])
  const isManager = userRole === 'MANAGER'
  const [newRow, setNewRow] = useState<NewRowState>({
    issue_date: today,
    property_id: defaultPropertyId ?? properties[0]?.id ?? '',
    account_id: '',
    supplier_id: '',
    document_type: '',
    document_number: '',
    amount_net: '',
    has_vat: false,
    vat_amount: '',
    payment_method: '',
    payment_source_id: '',
  })

  // Build payment sources filtered by selected payment method
  const allSources: PaymentSource[] = [
    ...bankAccounts.map(ba => ({ id: ba.id, name: `🏦 ${ba.name}`, type: 'bank' as const, allowed_payments: ba.allowed_payments ?? [] })),
    ...coCash.map(c => ({ id: c.id, name: `💰 ${c.name}`, type: 'cash' as const, allowed_payments: c.allowed_payments ?? [] })),
  ]
  const filteredSources = newRow.payment_method
    ? allSources.filter(s => s.allowed_payments.length === 0 || s.allowed_payments.includes(newRow.payment_method))
    : allSources
  const [errors, setErrors] = useState<NewRowErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { isHidden } = useHiddenAccounts(newRow.property_id || defaultPropertyId)

  function setField<K extends keyof NewRowState>(key: K, value: NewRowState[K]) {
    setNewRow((prev) => {
      const updated = { ...prev, [key]: value }
      // Reset payment source when payment method changes
      if (key === 'payment_method') updated.payment_source_id = ''
      // Auto-calc VAT when net changes and has_vat is on
      if (key === 'amount_net' && prev.has_vat) {
        updated.vat_amount = (Math.round(parseFloat(value as string || '0') * 20) / 100).toFixed(2)
      }
      return updated
    })
    setErrors((prev) => ({ ...prev, [key]: false }))
  }

  function toggleVat() {
    setNewRow((prev) => {
      const hasVat = !prev.has_vat
      const net = parseFloat(prev.amount_net) || 0
      return {
        ...prev,
        has_vat: hasVat,
        vat_amount: hasVat ? (Math.round(net * 20) / 100).toFixed(2) : '',
      }
    })
  }

  function validate(): boolean {
    const errs: NewRowErrors = {}
    if (!newRow.issue_date) errs.issue_date = true
    if (isCO && !newRow.property_id) errs.property_id = true
    if (!newRow.account_id) errs.account_id = true
    if (!newRow.supplier_id) errs.supplier_id = true
    if (!newRow.document_type) errs.document_type = true
    const requiresDocNumber = newRow.document_type === 'INVOICE' || newRow.document_type === 'CREDIT_NOTE'
    if (requiresDocNumber && !newRow.document_number.trim()) errs.document_number = true
    const amountNet = parseFloat(newRow.amount_net)
    const isCreditNote = newRow.document_type === 'CREDIT_NOTE'
    if (!newRow.amount_net || isNaN(amountNet) || amountNet === 0) errs.amount_net = true
    else if (!isCreditNote && amountNet < 0) errs.amount_net = true
    if (!newRow.payment_method) errs.payment_method = true
    // Manager doesn't pick a payment source — cash goes to property register, bank goes to CO
    // CO doesn't need to pick a source when creating — it's set at payment time
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave(submit: boolean) {
    if (!validate()) return
    setSaveError(null)
    setLoading(true)

    const amountNet = parseFloat(newRow.amount_net) || 0
    const vatAmount = parseFloat(newRow.vat_amount) || 0

    const selectedSource = allSources.find(s => s.id === newRow.payment_source_id)
    const body: Record<string, unknown> = {
      property_id: newRow.property_id || defaultPropertyId,
      account_id: newRow.account_id,
      supplier_id: newRow.supplier_id,
      document_type: newRow.document_type,
      document_number: newRow.document_number.trim() || null,
      issue_date: newRow.issue_date,
      due_date: newRow.issue_date,
      amount_net: amountNet,
      vat_amount: vatAmount,
      payment_method: newRow.payment_method,
      bank_account_id: selectedSource?.type === 'bank' ? selectedSource.id : null,
      co_cash_id: selectedSource?.type === 'cash' ? selectedSource.id : null,
    }

    // Manager paying cash: mark as paid from property cash register
    if (isManager && newRow.payment_method === 'CASH') {
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
        setSaveError(details ?? data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      const saved = await res.json()

      if (submit && saved.status === 'DRAFT') {
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
      const supplier = suppliers.find(s => s.id === newRow.supplier_id)
      const account = accounts.find(a => a.id === newRow.account_id)
      const bankAccount = selectedSource?.type === 'bank' ? bankAccounts.find(ba => ba.id === selectedSource.id) : null
      const coCashItem = selectedSource?.type === 'cash' ? coCash.find(c => c.id === selectedSource.id) : null
      const optimistic: ExpenseWithJoins = {
        ...saved,
        departments: null,
        properties: { name: property?.name ?? '' },
        suppliers: supplier ? { name: supplier.name } : null,
        usali_accounts: account ? { code: account.code, name: account.name } : null,
        bank_accounts: bankAccount ? { name: bankAccount.name } : null,
        co_cash: coCashItem ? { name: coCashItem.name } : null,
      }
      setExpenses((prev) => [optimistic, ...prev])

      // Reset new row
      setNewRow({
        issue_date: today,
        property_id: defaultPropertyId ?? properties[0]?.id ?? '',
        account_id: '',
        supplier_id: '',
        document_type: '',
        document_number: '',
        amount_net: '',
        has_vat: false,
        vat_amount: '',
        payment_method: '',
        payment_source_id: '',
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
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">№</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">Нето</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">ДДС</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">Общо</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Плащане</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Източник</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">Статус</th>
              <th className="px-2 py-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {/* New row — at top */}
            {canCreate && (
              <tr className="border-b border-border bg-primary/5">
                <td className="px-1 py-1 min-w-[130px]">
                  <DateInput
                    value={newRow.issue_date}
                    onChange={(e) => setField('issue_date', e.target.value)}
                    className={errors.issue_date ? inputErrorClass : inputClass}
                  />
                </td>
                {isCO && (
                  <td className="px-1 py-1 min-w-[110px]">
                    <FilterSelect
                      value={newRow.property_id}
                      onChange={(v) => setField('property_id', v)}
                      options={properties.map(p => ({ value: p.id, label: p.name }))}
                      placeholder="Обект"
                      error={errors.property_id}
                    />
                  </td>
                )}
                <td className="px-1 py-1 min-w-[110px]">
                  <FilterSelect
                    value={newRow.account_id}
                    onChange={(v) => setField('account_id', v)}
                    options={accounts
                      .filter(a => a.account_type === 'EXPENSE' && a.level === 3 && !isHidden(a.id))
                      .map(a => ({ value: a.id, label: a.name }))}
                    placeholder="Сметка..."
                    error={errors.account_id}
                  />
                </td>
                <td className="px-1 py-1 min-w-[120px]">
                  <FilterSelect
                    value={newRow.supplier_id}
                    onChange={(v) => setField('supplier_id', v)}
                    options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                    placeholder="Доставчик..."
                    error={errors.supplier_id}
                  />
                </td>
                <td className="px-1 py-1 min-w-[110px]">
                  <FilterSelect
                    value={newRow.document_type}
                    onChange={(v) => setField('document_type', v)}
                    options={(Object.keys(documentTypeLabels) as DocumentType[]).map(k => ({ value: k, label: documentTypeLabels[k] }))}
                    placeholder="Документ"
                    error={errors.document_type}
                  />
                </td>
                <td className="px-1 py-1 min-w-[90px]">
                  <input
                    type="text"
                    placeholder={newRow.document_type === 'INVOICE' || newRow.document_type === 'CREDIT_NOTE' ? '№ *' : '№'}
                    value={newRow.document_number}
                    onChange={(e) => setField('document_number', e.target.value)}
                    className={errors.document_number ? inputErrorClass : inputClass}
                  />
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
                  <div className="flex items-center gap-1">
                    <label className="flex items-center cursor-pointer shrink-0" title="ДДС 20%">
                      <input
                        type="checkbox"
                        checked={newRow.has_vat}
                        onChange={toggleVat}
                        className="h-3 w-3 rounded border-border accent-primary"
                      />
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={newRow.vat_amount}
                      onChange={(e) => setField('vat_amount', e.target.value)}
                      disabled={newRow.has_vat}
                      className={`${inputClass} text-right ${newRow.has_vat ? 'bg-muted' : ''}`}
                    />
                  </div>
                </td>
                <td className="px-2 py-1 text-right font-mono text-muted-foreground whitespace-nowrap">
                  {((parseFloat(newRow.amount_net) || 0) + (parseFloat(newRow.vat_amount) || 0)).toFixed(2)}
                </td>
                <td className="px-1 py-1 min-w-[90px]">
                  <FilterSelect
                    value={newRow.payment_method}
                    onChange={(v) => setField('payment_method', v)}
                    options={isManager
                      ? [{ value: 'CASH', label: 'Брой' }, { value: 'BANK_TRANSFER', label: 'Банков' }]
                      : (Object.keys(paymentMethodLabels) as PaymentMethod[]).map(k => ({ value: k, label: paymentMethodLabels[k] }))
                    }
                    placeholder="Плащане"
                    error={errors.payment_method}
                  />
                </td>
                <td className="px-1 py-1 min-w-[120px]">
                  {isManager ? (
                    <span className="text-[10px] text-muted-foreground px-1">
                      {newRow.payment_method === 'CASH' ? 'Каса обект' : newRow.payment_method === 'BANK_TRANSFER' ? 'Към ЦО' : '—'}
                    </span>
                  ) : (
                    <FilterSelect
                      value={newRow.payment_source_id}
                      onChange={(v) => setField('payment_source_id', v)}
                      options={filteredSources.map(s => ({ value: s.id, label: s.name }))}
                      placeholder="Каса/Банка..."
                      error={errors.payment_source_id}
                    />
                  )}
                </td>
                <td className="px-1 py-1 whitespace-nowrap">
                  <button
                    disabled={loading}
                    onClick={() => handleSave(false)}
                    className="px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 whitespace-nowrap"
                    title={
                      newRow.document_type === 'CREDIT_NOTE'
                        ? 'Запази кредитното известие'
                        : newRow.payment_method === 'CASH'
                          ? 'Записва и маркира като платен от касата'
                          : newRow.payment_method === 'BANK_TRANSFER'
                            ? 'Записва и изпраща към ЦО за плащане'
                            : 'Запази'
                    }
                  >
                    {loading
                      ? '...'
                      : newRow.document_type === 'CREDIT_NOTE'
                        ? 'Запази КИ'
                        : newRow.payment_method === 'CASH'
                          ? 'Плати от каса'
                          : newRow.payment_method === 'BANK_TRANSFER'
                            ? 'Изпрати към ЦО'
                            : 'Запази'}
                  </button>
                </td>
                <td />
              </tr>
            )}

            {expenses.length === 0 && !canCreate && (
              <tr>
                <td
                  colSpan={isCO ? 13 : 12}
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
                <td className="px-2 py-1 whitespace-nowrap font-medium">{fmtDate(expense.issue_date)}</td>
                {isCO && (
                  <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                    {expense.properties.name}
                  </td>
                )}
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {expense.usali_accounts?.name ?? '—'}
                </td>
                <td className="px-2 py-1 text-muted-foreground max-w-[140px] truncate">
                  {expense.suppliers?.name ?? expense.supplier}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {expense.document_type === 'CREDIT_NOTE' ? (
                    <Badge className="text-[0.65rem] px-1 py-0 bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/15">
                      КИ
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{documentTypeLabels[expense.document_type]}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap font-mono">
                  {expense.document_number ?? '—'}
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
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {expense.bank_accounts?.name ?? expense.co_cash?.name ?? '—'}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  <Badge variant={statusVariants[expense.status]} className="text-[0.65rem] px-1 py-0">
                    {statusLabels[expense.status]}
                  </Badge>
                </td>
                <td className="px-2 py-1 text-right">
                  {isCO && !['PAID', 'PARTIAL', 'REJECTED'].includes(expense.status) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/finance/expenses/${expense.id}/edit`)
                      }}
                      className="p-1 rounded hover:bg-muted text-primary"
                      title="Редактирай"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Totals row */}
            {expenses.length > 0 && (
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td
                  className="px-2 py-1.5 text-muted-foreground text-xs"
                  colSpan={isCO ? 7 : 6}
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
                <td colSpan={4} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
