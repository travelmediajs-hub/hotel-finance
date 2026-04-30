'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { FilterSelect } from '@/components/finance/FilterSelect'
import { useHiddenAccounts } from '@/lib/finance/useHiddenAccounts'
import { DateInput } from '@/components/ui/date-input'
import { fmtDate } from '@/lib/utils'
import type {
  IncomeEntry,
  IncomeEntryType,
  IncomePaymentMethod,
  IncomeEntryStatus,
} from '@/types/finance'

export type IncomeEntryWithJoins = IncomeEntry & {
  properties: { name: string }
  usali_accounts: { code: string; name: string } | null
}

type PaymentSource = {
  id: string
  name: string
  type: 'bank' | 'cash'
  allowed_payments: string[]
}

interface Props {
  entries: IncomeEntryWithJoins[]
  properties: Array<{ id: string; name: string }>
  bankAccounts: Array<{ id: string; name: string; iban: string; allowed_payments: string[] }>
  coCash: Array<{ id: string; name: string; allowed_payments: string[] }>
  loans: Array<{ id: string; bank: string; name: string }>
  accounts: Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>
  canCreate: boolean
}

const typeLabels: Record<IncomeEntryType, string> = {
  INC_BANK: 'Банков',
  INC_CASH: 'Брой',
  INC_ADV: 'Аванс',
  INC_DEP: 'Депозит',
  INC_OTHER: 'Друг',
  INC_CREDIT_NOTE: 'КИ',
  CF_CREDIT: 'Кредит',
  CF_TRANSFER: 'Трансфер',
}

const statusLabels: Record<IncomeEntryStatus, string> = {
  ENTERED: 'Въведен',
  CONFIRMED: 'Потвърден',
  ADVANCE: 'Аванс',
  REALIZED: 'Реализиран',
}

const statusClasses: Record<IncomeEntryStatus, string> = {
  ENTERED: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  CONFIRMED: 'bg-green-500/15 text-green-500 border-green-500/30',
  ADVANCE: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  REALIZED: 'bg-green-500/15 text-green-500 border-green-500/30',
}

const paymentLabels: Record<IncomePaymentMethod, string> = {
  BANK: 'Банка',
  CASH: 'Брой',
}

const typeOptions: { value: IncomeEntryType; label: string }[] = [
  { value: 'INC_BANK', label: 'Банков' },
  { value: 'INC_CASH', label: 'Брой' },
  { value: 'INC_ADV', label: 'Аванс' },
  { value: 'INC_DEP', label: 'Депозит' },
  { value: 'INC_OTHER', label: 'Друг' },
  { value: 'INC_CREDIT_NOTE', label: 'КИ' },
  { value: 'CF_CREDIT', label: 'Кредит' },
  { value: 'CF_TRANSFER', label: 'Трансфер' },
]

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const inputCls =
  'bg-transparent border border-border rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring'
const inputErrCls =
  'bg-transparent border border-destructive rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-destructive'
const selectCls =
  'bg-transparent border border-border rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring [&_option]:bg-zinc-900 [&_option]:text-zinc-100'
const selectErrCls =
  'bg-transparent border border-destructive rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-destructive [&_option]:bg-zinc-900 [&_option]:text-zinc-100'

export function IncomeSpreadsheet({ entries: initialEntries, properties, bankAccounts, coCash, loans, accounts, canCreate }: Props) {
  const router = useRouter()
  const today = toDateString(new Date())

  const [entries, setEntries] = useState<IncomeEntryWithJoins[]>(initialEntries ?? [])
  const [entryDate, setEntryDate] = useState(today)
  const [propertyId, setPropertyId] = useState('')
  const [type, setType] = useState<IncomeEntryType | ''>('')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<IncomePaymentMethod | ''>('')
  const [paymentSourceId, setPaymentSourceId] = useState('')
  const [note, setNote] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})
  const { isHidden } = useHiddenAccounts(propertyId || undefined)

  const showCategory = type.startsWith('INC_')
  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  // Payment sources filtered by payment method
  const allSources: PaymentSource[] = [
    ...bankAccounts.map(ba => ({ id: ba.id, name: `🏦 ${ba.name}`, type: 'bank' as const, allowed_payments: ba.allowed_payments ?? [] })),
    ...coCash.map(c => ({ id: c.id, name: `💰 ${c.name}`, type: 'cash' as const, allowed_payments: c.allowed_payments ?? [] })),
  ]
  // Map BANK/CASH to allowed_payments values
  const pmMapping: Record<string, string> = { BANK: 'BANK_TRANSFER', CASH: 'CASH' }
  const mappedPM = paymentMethod ? pmMapping[paymentMethod] : ''
  const filteredSources = mappedPM
    ? allSources.filter(s => s.allowed_payments.length === 0 || s.allowed_payments.includes(mappedPM))
    : allSources

  function validate(): boolean {
    const errs: Record<string, boolean> = {}
    if (!entryDate) errs.entryDate = true
    if (!propertyId) errs.propertyId = true
    if (!type) errs.type = true
    if (!amount || parseFloat(amount) <= 0) errs.amount = true
    if (!paymentMethod) errs.paymentMethod = true
    // payer removed
    if (showCategory && !accountId) errs.accountId = true
    if (!paymentSourceId) errs.paymentSourceId = true
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    setError(null)
    if (!validate()) {
      setError('Моля, попълнете всички задължителни полета.')
      return
    }

    setLoading(true)
    try {
      const selectedSource = allSources.find(s => s.id === paymentSourceId)
      const body = {
        entry_date: entryDate,
        property_id: propertyId,
        type,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        payer: '-',
        account_id: showCategory && accountId ? accountId : null,
        bank_account_id: selectedSource?.type === 'bank' ? selectedSource.id : null,
        description: note.trim() || null,
      }

      const res = await fetch('/api/finance/income', {
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

      // Optimistic update
      const property = properties.find(p => p.id === propertyId)
      const account = accounts.find(a => a.id === accountId)
      const optimistic: IncomeEntryWithJoins = {
        ...saved,
        properties: { name: property?.name ?? '' },
        usali_accounts: account ? { code: account.code, name: account.name } : null,
      }
      setEntries(prev => [optimistic, ...prev])

      // Reset
      setEntryDate(today)
      setPropertyId('')
      setType('')
      setAccountId('')
      setAmount('')
      setPaymentMethod('')
      setPaymentSourceId('')
      setNote('')
      setFieldErrors({})
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Дата</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Обект</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Тип</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Сметка</th>
              <th className="text-right px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Сума</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Плащане</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Източник</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Забележка</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Статус</th>
            </tr>
          </thead>
          <tbody>
            {/* New row — at top */}
            {canCreate && (
              <tr className="bg-primary/5 border-b border-border">
                <td className="px-1 py-1">
                  <DateInput
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className={fieldErrors.entryDate ? inputErrCls : inputCls}
                  />
                </td>
                <td className="px-1 py-1 min-w-[120px]">
                  <FilterSelect
                    value={propertyId}
                    onChange={setPropertyId}
                    options={properties.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Обект..."
                    error={fieldErrors.propertyId}
                  />
                </td>
                <td className="px-1 py-1 min-w-[100px]">
                  <FilterSelect
                    value={type}
                    onChange={(v) => {
                      setType(v as IncomeEntryType | '')
                      if (v && !v.startsWith('INC_')) setAccountId('')
                    }}
                    options={typeOptions.map(o => ({ value: o.value, label: o.label }))}
                    placeholder="Тип..."
                    error={fieldErrors.type}
                  />
                </td>
                <td className="px-1 py-1 min-w-[100px]">
                  {showCategory ? (
                    <FilterSelect
                      value={accountId}
                      onChange={setAccountId}
                      options={accounts
                        .filter(a => a.account_type === 'REVENUE' && a.level === 3 && !isHidden(a.id))
                        .map(a => ({ value: a.id, label: a.name }))}
                      placeholder="Сметка..."
                      error={fieldErrors.accountId}
                    />
                  ) : (
                    <span className="text-muted-foreground px-1">—</span>
                  )}
                </td>
                <td className="px-1 py-1 min-w-[90px]">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`${fieldErrors.amount ? inputErrCls : inputCls} text-right`}
                  />
                </td>
                <td className="px-1 py-1 min-w-[80px]">
                  <FilterSelect
                    value={paymentMethod}
                    onChange={(v) => {
                      setPaymentMethod(v as IncomePaymentMethod | '')
                      setPaymentSourceId('')
                    }}
                    options={[
                      { value: 'BANK', label: 'Банка' },
                      { value: 'CASH', label: 'Брой' },
                    ]}
                    placeholder="Начин..."
                    error={fieldErrors.paymentMethod}
                  />
                </td>
                <td className="px-1 py-1 min-w-[120px]">
                  <FilterSelect
                    value={paymentSourceId}
                    onChange={setPaymentSourceId}
                    options={filteredSources.map(s => ({ value: s.id, label: s.name }))}
                    placeholder="Каса/Банка..."
                    error={fieldErrors.paymentSourceId}
                  />
                </td>
                <td className="px-1 py-1 min-w-[140px]">
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Забележка..."
                    className={inputCls}
                  />
                </td>
                <td className="px-1 py-1 whitespace-nowrap">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                  >
                    {loading ? '...' : 'Запази'}
                  </button>
                </td>
              </tr>
            )}

            {entries.length === 0 && !canCreate && (
              <tr>
                <td colSpan={9} className="text-center text-muted-foreground py-8">
                  Няма приходни записи
                </td>
              </tr>
            )}

            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => router.push(`/finance/income/${entry.id}`)}
              >
                <td className="px-2 py-1 font-mono whitespace-nowrap">{fmtDate(entry.entry_date)}</td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                  {entry.properties.name}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {typeLabels[entry.type]}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {entry.usali_accounts?.name ?? '—'}
                </td>
                <td className="px-2 py-1 text-right font-mono whitespace-nowrap">
                  {entry.amount.toFixed(2)} €
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {paymentLabels[entry.payment_method]}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  —
                </td>
                <td className="px-2 py-1 text-muted-foreground max-w-[200px] truncate" title={entry.description ?? ''}>
                  {entry.description ?? '—'}
                </td>
                <td className="px-2 py-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1 py-0 ${statusClasses[entry.status]}`}
                  >
                    {statusLabels[entry.status]}
                  </Badge>
                </td>
              </tr>
            ))}

            {/* Total row */}
            {entries.length > 0 && (
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td colSpan={4} className="px-2 py-1.5 text-muted-foreground text-xs">
                  Общо ({entries.length})
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs">
                  {total.toFixed(2)} €
                </td>
                <td colSpan={5} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
