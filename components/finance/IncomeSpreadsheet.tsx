'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
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

interface Props {
  entries: IncomeEntryWithJoins[]
  properties: Array<{ id: string; name: string }>
  bankAccounts: Array<{ id: string; name: string; iban: string }>
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
  'bg-transparent border border-border rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring'
const selectErrCls =
  'bg-transparent border border-destructive rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-destructive'

export function IncomeSpreadsheet({ entries, properties, bankAccounts, loans, accounts, canCreate }: Props) {
  const router = useRouter()
  const today = toDateString(new Date())

  const [entryDate, setEntryDate] = useState(today)
  const [propertyId, setPropertyId] = useState('')
  const [type, setType] = useState<IncomeEntryType | ''>('')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<IncomePaymentMethod | ''>('')
  const [payer, setPayer] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})

  const showCategory = type.startsWith('INC_')
  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  function validate(): boolean {
    const errs: Record<string, boolean> = {}
    if (!entryDate) errs.entryDate = true
    if (!propertyId) errs.propertyId = true
    if (!type) errs.type = true
    if (!amount || parseFloat(amount) <= 0) errs.amount = true
    if (!paymentMethod) errs.paymentMethod = true
    if (!payer.trim()) errs.payer = true
    if (showCategory && !accountId) errs.accountId = true
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
      const body = {
        entry_date: entryDate,
        property_id: propertyId,
        type,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        payer: payer.trim(),
        account_id: showCategory && accountId ? accountId : null,
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

      // Clear inputs
      setEntryDate(today)
      setPropertyId('')
      setType('')
      setAccountId('')
      setAmount('')
      setPaymentMethod('')
      setPayer('')
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
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Платец</th>
              <th className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">Статус</th>
              {canCreate && <th className="px-2 py-1" />}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !canCreate && (
              <tr>
                <td colSpan={8} className="text-center text-muted-foreground py-8">
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
                <td className="px-2 py-1 font-mono whitespace-nowrap">{entry.entry_date}</td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                  {entry.properties.name}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {typeLabels[entry.type]}
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {entry.usali_accounts ? `${entry.usali_accounts.code} ${entry.usali_accounts.name}` : '—'}
                </td>
                <td className="px-2 py-1 text-right font-mono whitespace-nowrap">
                  {entry.amount.toFixed(2)} лв.
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">
                  {paymentLabels[entry.payment_method]}
                </td>
                <td className="px-2 py-1 text-muted-foreground max-w-[120px] truncate">
                  {entry.payer}
                </td>
                <td className="px-2 py-1">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1 py-0 ${statusClasses[entry.status]}`}
                  >
                    {statusLabels[entry.status]}
                  </Badge>
                </td>
                {canCreate && <td className="px-2 py-1" />}
              </tr>
            ))}

            {/* Total row */}
            {entries.length > 0 && (
              <tr className="border-b border-border bg-muted/20">
                <td colSpan={4} className="px-2 py-1 font-semibold text-muted-foreground">
                  Общо ({entries.length} записа)
                </td>
                <td className="px-2 py-1 text-right font-semibold font-mono whitespace-nowrap">
                  {total.toFixed(2)} лв.
                </td>
                <td colSpan={canCreate ? 4 : 3} />
              </tr>
            )}

            {/* New row */}
            {canCreate && (
              <tr className="bg-primary/5 border-b border-border">
                <td className="px-2 py-1">
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className={fieldErrors.entryDate ? inputErrCls : inputCls}
                  />
                </td>
                <td className="px-2 py-1 min-w-[120px]">
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className={fieldErrors.propertyId ? selectErrCls : selectCls}
                  >
                    <option value="">— обект —</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1 min-w-[100px]">
                  <select
                    value={type}
                    onChange={(e) => {
                      const v = e.target.value as IncomeEntryType | ''
                      setType(v)
                      if (v && !v.startsWith('INC_')) setAccountId('')
                    }}
                    className={fieldErrors.type ? selectErrCls : selectCls}
                  >
                    <option value="">— тип —</option>
                    {typeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1 min-w-[100px]">
                  {showCategory ? (
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className="w-full bg-transparent text-xs border-0 focus:ring-1 focus:ring-primary px-1 py-0.5"
                    >
                      <option value="">Сметка...</option>
                      {accounts
                        .filter(a => a.account_type === 'REVENUE' && a.level === 3)
                        .map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code} {a.name}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="text-muted-foreground px-1">—</span>
                  )}
                </td>
                <td className="px-2 py-1 min-w-[90px]">
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
                <td className="px-2 py-1 min-w-[80px]">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as IncomePaymentMethod | '')}
                    className={fieldErrors.paymentMethod ? selectErrCls : selectCls}
                  >
                    <option value="">— начин —</option>
                    <option value="BANK">Банка</option>
                    <option value="CASH">Брой</option>
                  </select>
                </td>
                <td className="px-2 py-1 min-w-[120px]">
                  <input
                    type="text"
                    value={payer}
                    onChange={(e) => setPayer(e.target.value)}
                    placeholder="Платец"
                    className={fieldErrors.payer ? inputErrCls : inputCls}
                  />
                </td>
                <td className="px-2 py-1">
                  <span className="text-muted-foreground text-[10px]">нов</span>
                </td>
                <td className="px-2 py-1">
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
          </tbody>
        </table>
      </div>
    </div>
  )
}
