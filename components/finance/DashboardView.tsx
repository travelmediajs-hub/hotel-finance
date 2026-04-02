'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { fmtDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string
  name: string
  iban: string
  bank: string
  currency: string
  current_balance: number
  last_transaction_date: string | null
}

interface COCashRegister {
  id: string
  name: string
  current_balance: number
}

interface COCash {
  registers: COCashRegister[]
  total_balance: number
}

interface Loan {
  id: string
  bank: string
  original_amount: number
  remaining_balance: number
  monthly_payment: number
  next_payment_date: string
  days_until_payment: number
  status: string
}

interface RevolvingCredit {
  id: string
  bank: string
  credit_limit: number
  used_amount: number
  available_amount: number
  utilization_pct: number
  status: string
}

interface UnpaidBySupplier {
  name: string
  remaining: number
  count: number
}

interface UnpaidExpenses {
  total: number
  count: number
  by_supplier: UnpaidBySupplier[]
}

interface PendingReports {
  daily_reports_count: number
  consolidations_count: number
}

interface UnconfirmedCollection {
  id: string
  property_name: string
  amount: number
  collection_date: string
}

interface UnaccountedAdvance {
  id: string
  property_name: string
  amount: number
  sent_date: string
  purpose: string | null
}

interface UpcomingLoanPayment {
  loan_id: string
  bank: string
  amount: number
  payment_date: string
  days_until: number
}

interface DashboardData {
  bank_accounts: BankAccount[]
  co_cash: COCash
  loans: Loan[]
  revolving_credits: RevolvingCredit[]
  unpaid_expenses: UnpaidExpenses
  pending_reports: PendingReports
  unconfirmed_collections: UnconfirmedCollection[]
  unaccounted_advances: UnaccountedAdvance[]
  upcoming_loan_payments: UpcomingLoanPayment[]
  net_cash_position: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return amount.toLocaleString('bg-BG', { minimumFractionDigits: 2 }) + ' €'
}

function getDaysColor(days: number): string {
  if (days > 7) return 'text-green-500'
  if (days >= 3) return 'text-yellow-500'
  return 'text-red-500'
}

function getUtilizationColor(pct: number): string {
  if (pct < 60) return 'bg-green-500'
  if (pct <= 80) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800 ${className ?? ''}`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unpaidOpen, setUnpaidOpen] = useState(false)

  useEffect(() => {
    fetch('/api/finance/dashboard')
      .then(res => {
        if (!res.ok) throw new Error(`Грешка при зареждане: ${res.status}`)
        return res.json()
      })
      .then((d: DashboardData) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Неизвестна грешка'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-800 bg-red-950/30">
          <CardContent className="pt-6">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const {
    bank_accounts,
    co_cash: rawCoCash,
    loans,
    revolving_credits,
    unpaid_expenses,
    pending_reports,
    unconfirmed_collections,
    unaccounted_advances,
    upcoming_loan_payments,
    net_cash_position,
  } = data

  // Backwards compat: handle old format (single balance) or new (registers array)
  const co_cash: COCash = rawCoCash?.registers
    ? rawCoCash
    : { registers: [], total_balance: (rawCoCash as unknown as { current_balance?: number })?.current_balance ?? 0 }

  const netPositive = net_cash_position >= 0

  return (
    <div className="p-6 space-y-6">
      {/* ── Net Cash Position ────────────────────────────── */}
      <Card className={netPositive ? 'border-green-800 bg-green-950/20' : 'border-red-800 bg-red-950/20'}>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
              Нетна парична позиция
            </span>
            <span className={`text-3xl font-bold font-mono ${netPositive ? 'text-green-400' : 'text-red-400'}`}>
              {netPositive ? '' : '−'}{formatAmount(Math.abs(net_cash_position))}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Top Row: Bank Accounts | CO Cash | Pending Reports ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Банкови сметки */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span>📊</span> Банкови сметки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bank_accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Няма банкови сметки</p>
            ) : (
              bank_accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[140px]" title={acc.name}>
                    {acc.bank} — {acc.name}
                  </span>
                  <span className={`font-mono font-medium ${acc.current_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatAmount(acc.current_balance)}
                  </span>
                </div>
              ))
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Общо</span>
              <span className="font-mono text-foreground">
                {formatAmount(bank_accounts.reduce((s, a) => s + a.current_balance, 0))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Каса ЦО */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span>💰</span> Каси ЦО
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {co_cash.registers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Няма каси</p>
            ) : (
              co_cash.registers.map(reg => (
                <div key={reg.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[140px]" title={reg.name}>
                    {reg.name}
                  </span>
                  <span className={`font-mono font-medium ${reg.current_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatAmount(reg.current_balance)}
                  </span>
                </div>
              ))
            )}
            {co_cash.registers.length > 1 && (
              <>
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">Общо</span>
                  <span className={`font-mono ${co_cash.total_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatAmount(co_cash.total_balance)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Чакащи отчети */}
        {(pending_reports.daily_reports_count > 0 || pending_reports.consolidations_count > 0) && (
          <Card className="border-yellow-800/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span> Чакащи отчети
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending_reports.daily_reports_count > 0 && (
                <Link
                  href="/finance/daily-reports"
                  className="flex items-center justify-between text-sm hover:text-foreground transition-colors group"
                >
                  <span className="text-muted-foreground group-hover:text-foreground">Дневни отчети</span>
                  <Badge variant="destructive">{pending_reports.daily_reports_count}</Badge>
                </Link>
              )}
              {pending_reports.consolidations_count > 0 && (
                <Link
                  href="/finance/consolidations"
                  className="flex items-center justify-between text-sm hover:text-foreground transition-colors group"
                >
                  <span className="text-muted-foreground group-hover:text-foreground">Консолидации</span>
                  <Badge variant="destructive">{pending_reports.consolidations_count}</Badge>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Кредити */}
        {loans.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span>🏦</span> Кредити
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loans.map(loan => (
                <div key={loan.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{loan.bank}</span>
                    <Badge variant="outline" className="text-xs">{loan.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Остатък: <span className="font-mono text-foreground">{formatAmount(loan.remaining_balance)}</span></span>
                    <span>Вноска: <span className="font-mono text-foreground">{formatAmount(loan.monthly_payment)}</span></span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Дни до вноска: </span>
                    <span className={`font-semibold ${getDaysColor(loan.days_until_payment)}`}>
                      {loan.days_until_payment}
                    </span>
                    <span className="text-muted-foreground ml-1">({fmtDate(loan.next_payment_date)})</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Revolving кредити */}
        {revolving_credits.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span>🔄</span> Revolving кредити
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {revolving_credits.map(rev => (
                <div key={rev.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{rev.bank}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {rev.utilization_pct.toFixed(0)}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getUtilizationColor(rev.utilization_pct)}`}
                      style={{ width: `${Math.min(rev.utilization_pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Усвоено: <span className="font-mono text-foreground">{formatAmount(rev.used_amount)}</span></span>
                    <span>Свободно: <span className="font-mono text-green-400">{formatAmount(rev.available_amount)}</span></span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Лимит: <span className="font-mono text-foreground">{formatAmount(rev.credit_limit)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Unpaid Expenses ─────────────────────────────── */}
      {unpaid_expenses.count > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              type="button"
              className="w-full flex items-center justify-between text-left"
              onClick={() => setUnpaidOpen(o => !o)}
            >
              <CardTitle className="text-sm font-semibold">
                Неплатени разходи
                <Badge variant="destructive" className="ml-2 text-xs">{unpaid_expenses.count}</Badge>
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-red-400">{formatAmount(unpaid_expenses.total)}</span>
                <svg
                  className={`h-4 w-4 text-muted-foreground transition-transform ${unpaidOpen ? 'rotate-180' : ''}`}
                  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>
          </CardHeader>
          {unpaidOpen && (
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Доставчик</TableHead>
                    <TableHead className="text-right">Брой</TableHead>
                    <TableHead className="text-right">Остатък</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaid_expenses.by_supplier.map(s => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{s.count}</TableCell>
                      <TableCell className="text-right font-mono text-red-400">{formatAmount(s.remaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Bottom Row: Unconfirmed Collections | Unaccounted Advances ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Несъбрани наличности */}
        {unconfirmed_collections.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Несъбрани наличности
                <Badge variant="destructive" className="ml-2 text-xs">{unconfirmed_collections.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unconfirmed_collections.map(col => (
                <div key={col.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-foreground">{col.property_name}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(col.collection_date)}</p>
                  </div>
                  <span className="font-mono font-medium text-yellow-400">{formatAmount(col.amount)}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-muted-foreground">Общо</span>
                <span className="font-mono text-yellow-400">
                  {formatAmount(unconfirmed_collections.reduce((s, c) => s + c.amount, 0))}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Неотчетени аванси */}
        {unaccounted_advances.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Неотчетени аванси
                <Badge variant="destructive" className="ml-2 text-xs">{unaccounted_advances.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unaccounted_advances.map(adv => (
                <div key={adv.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-foreground">{adv.property_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(adv.sent_date)}{adv.purpose ? ` — ${adv.purpose}` : ''}
                    </p>
                  </div>
                  <span className="font-mono font-medium text-orange-400">{formatAmount(adv.amount)}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-muted-foreground">Общо</span>
                <span className="font-mono text-orange-400">
                  {formatAmount(unaccounted_advances.reduce((s, a) => s + a.amount, 0))}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Upcoming Loan Payments ───────────────────────── */}
      {upcoming_loan_payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Предстоящи вноски (7 дни)
              <Badge variant="outline" className="ml-2 text-xs">{upcoming_loan_payments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Банка</TableHead>
                  <TableHead className="text-right">Вноска</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Дни до вноска</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming_loan_payments.map(p => (
                  <TableRow key={p.loan_id}>
                    <TableCell className="font-medium">{p.bank}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(p.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${getDaysColor(p.days_until)}`}>
                        {p.days_until}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
