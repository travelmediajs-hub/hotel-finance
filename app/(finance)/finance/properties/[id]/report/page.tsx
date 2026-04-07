import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PropertyExpensesByCategory } from '@/components/finance/PropertyExpensesByCategory'
import { UnpaidSuppliersList } from '@/components/finance/UnpaidSuppliersList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RevenueDashboard } from '@/components/finance/RevenueDashboard'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}

const fmt = (n: number) =>
  new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
}

export default async function PropertyReportPage({ params, searchParams }: Props) {
  const { id } = await params
  const { from, to } = await searchParams
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  // Accept both ISO (yyyy-mm-dd) and dd.mm.yyyy in URL params
  const parseDate = (s?: string): string | null => {
    if (!s) return null
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m1) return s
    const m2 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`
    return null
  }
  const isoToDmy = (iso: string) => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }

  const today = new Date()
  const defFrom = parseDate(from) || new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().slice(0, 10)
  const defTo = parseDate(to) || today.toISOString().slice(0, 10)

  const { data: property } = await supabase.from('properties').select('*').eq('id', id).single()
  if (!property) notFound()

  const [incomeRes, expensesRes, cashBalanceRes, unpaidRes, posRes] = await Promise.all([
    supabase
      .from('income_entries')
      .select('entry_date, amount, type, payment_method, payer, description')
      .eq('property_id', id)
      .gte('entry_date', defFrom)
      .lte('entry_date', defTo),
    supabase
      .from('expenses')
      .select('issue_date, supplier, amount_net, vat_amount, status, payment_method, account_id')
      .eq('property_id', id)
      .gte('issue_date', defFrom)
      .lte('issue_date', defTo),
    supabase.from('property_cash_balances').select('current_balance').eq('property_id', id).maybeSingle(),
    supabase
      .from('expenses')
      .select('supplier, amount_net, vat_amount, status')
      .eq('property_id', id)
      .neq('status', 'PAID'),
    supabase
      .from('daily_reports')
      .select('date, total_pos_net')
      .eq('property_id', id)
      .gte('date', defFrom)
      .lte('date', defTo),
  ])

  if (expensesRes.error) console.error('expenses query error:', expensesRes.error)
  const income = incomeRes.data ?? []
  const expensesRaw = expensesRes.data ?? []
  // Fetch USALI accounts separately to avoid PostgREST embed dropping rows
  const acctIds = Array.from(new Set(expensesRaw.map((r: any) => r.account_id).filter(Boolean)))
  const usaliMap = new Map<string, { code: string; name: string; account_type: string }>()
  if (acctIds.length > 0) {
    const { data: ua } = await supabase
      .from('usali_accounts')
      .select('id, code, name, account_type')
      .in('id', acctIds)
    for (const a of ua ?? []) usaliMap.set(a.id, { code: a.code, name: a.name, account_type: a.account_type })
  }
  const expenses = expensesRaw.map((r: any) => ({
    ...r,
    usali_accounts: r.account_id ? usaliMap.get(r.account_id) ?? null : null,
  }))
  const cashBalance = (cashBalanceRes.data?.current_balance as number) ?? 0
  const unpaid = unpaidRes.data ?? []

  const totalExpenses = expenses.reduce(
    (s, r: any) => s + Number(r.amount_net || 0) + Number(r.vat_amount || 0),
    0,
  )

  // Кеш / Банка идват от income_entries; ПОС идва от daily_reports.total_pos_net
  const incomeByMonth = new Map<string, { cash: number; bank: number; pos: number; total: number }>()
  for (const r of income) {
    const ym = r.entry_date.slice(0, 7)
    const cur = incomeByMonth.get(ym) ?? { cash: 0, bank: 0, pos: 0, total: 0 }
    const amt = Number(r.amount || 0)
    const pm = (r.payment_method || '').toUpperCase()
    const tp = (r.type || '').toUpperCase()
    if (pm === 'CASH' || tp === 'INC_CASH') cur.cash += amt
    else cur.bank += amt
    cur.total += amt
    incomeByMonth.set(ym, cur)
  }
  for (const dr of (posRes.data ?? []) as any[]) {
    const ym = (dr.date as string).slice(0, 7)
    const amt = Number(dr.total_pos_net || 0)
    if (!amt) continue
    const cur = incomeByMonth.get(ym) ?? { cash: 0, bank: 0, pos: 0, total: 0 }
    cur.pos += amt
    cur.total += amt
    incomeByMonth.set(ym, cur)
  }
  const totalPos = (posRes.data ?? []).reduce((s: number, d: any) => s + Number(d.total_pos_net || 0), 0)
  const totalIncomeEntries = income.reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalIncome = totalIncomeEntries + totalPos
  const netResult = totalIncome - totalExpenses
  const incomeMonths = Array.from(incomeByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))

  // Expenses grouped by USALI account → months → entries
  type ExpEntry = { date: string; supplier: string; total: number; status: string }
  type ExpMonth = { ym: string; total: number; entries: ExpEntry[] }
  type ExpCategory = { code: string; name: string; total: number; months: ExpMonth[] }
  const CAT_LABELS: Record<string, string> = {
    CONSUMABLES: 'Консумативи',
    SALARIES: 'Заплати',
    FOOD_KITCHEN: 'Храни / Кухня',
    FUEL: 'Гориво',
    TAXES_FEES: 'Данъци и такси',
    MAINTENANCE: 'Поддръжка',
    UTILITIES: 'Консумативи (ток/вода)',
    MARKETING: 'Маркетинг',
    INSURANCE: 'Застраховки',
    ACCOUNTING: 'Счетоводство',
    OTHER: 'Други',
  }
  const catMap = new Map<string, ExpCategory>()
  for (const r of expenses as any[]) {
    const ua = r.usali_accounts
    const isRevenueAcc = ua?.account_type === 'REVENUE'
    let code: string
    let name: string
    if (ua?.code && !isRevenueAcc) {
      code = ua.code
      name = ua.name
    } else {
      code = '—'
      name = 'Без категория'
    }
    const total = Number(r.amount_net || 0) + Number(r.vat_amount || 0)
    const ym = (r.issue_date as string).slice(0, 7)
    const key = code + '|' + name
    let cat = catMap.get(key)
    if (!cat) {
      cat = { code, name, total: 0, months: [] }
      catMap.set(key, cat)
    }
    cat.total += total
    let m = cat.months.find((x) => x.ym === ym)
    if (!m) {
      m = { ym, total: 0, entries: [] }
      cat.months.push(m)
    }
    m.total += total
    m.entries.push({ date: r.issue_date, supplier: r.supplier, total, status: r.status })
  }
  const categories = Array.from(catMap.values()).sort((a, b) => b.total - a.total)

  // Unpaid by supplier
  const unpaidBySupplier = new Map<string, { total: number; count: number }>()
  let unpaidTotal = 0
  for (const r of unpaid as any[]) {
    const t = Number(r.amount_net || 0) + Number(r.vat_amount || 0)
    unpaidTotal += t
    const cur = unpaidBySupplier.get(r.supplier) ?? { total: 0, count: 0 }
    cur.total += t
    cur.count += 1
    unpaidBySupplier.set(r.supplier, cur)
  }
  const unpaidList = Array.from(unpaidBySupplier.entries())
    .map(([supplier, v]) => ({ supplier, ...v }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link href="/finance/dashboard" className="text-xs text-muted-foreground hover:underline">← Табло</Link>
          <h1 className="text-xl font-semibold mt-1">{property.name}</h1>
          <p className="text-xs text-muted-foreground">Финансов отчет</p>
        </div>
        <form className="flex items-end gap-2" method="get">
          <div>
            <label className="text-xs text-muted-foreground block">От</label>
            <input
              type="date"
              name="from"
              defaultValue={defFrom}
              className="border rounded px-2 py-1 text-sm bg-background w-40 cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">До</label>
            <input
              type="date"
              name="to"
              defaultValue={defTo}
              className="border rounded px-2 py-1 text-sm bg-background w-40 cursor-pointer"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm">Покажи</button>
        </form>
      </div>

      <Tabs defaultValue="finance">
        <TabsList>
          <TabsTrigger value="finance">💼 Финансов отчет</TabsTrigger>
          <TabsTrigger value="revenue">📊 Ревеню (PMS)</TabsTrigger>
        </TabsList>

        <TabsContent value="finance" className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Приходи</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-500">{fmt(totalIncome)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Разходи</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-rose-500">{fmt(totalExpenses)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Резултат</CardTitle></CardHeader>
          <CardContent className={'text-2xl font-semibold ' + (netResult >= 0 ? 'text-emerald-500' : 'text-rose-500')}>{fmt(netResult)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Налично в каса</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{fmt(cashBalance)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Приходи по месеци</CardTitle></CardHeader>
        <CardContent>
          {incomeMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground">Няма данни за избрания период.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Месец</TableHead>
                  <TableHead className="text-right">Кеш</TableHead>
                  <TableHead className="text-right">Банка</TableHead>
                  <TableHead className="text-right">ПОС</TableHead>
                  <TableHead className="text-right">Общо</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeMonths.map(([ym, v]) => (
                  <TableRow key={ym}>
                    <TableCell className="font-medium">{monthLabel(ym)}</TableCell>
                    <TableCell className="text-right">{fmt(v.cash)}</TableCell>
                    <TableCell className="text-right">{fmt(v.bank)}</TableCell>
                    <TableCell className="text-right">{fmt(v.pos)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Разходи по пера</CardTitle></CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Няма разходи за избрания период.</p>
            ) : (
              <PropertyExpensesByCategory categories={categories} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Структура на разходите</CardTitle></CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Няма данни.</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const max = Math.max(...categories.map((c) => c.total))
                  return categories.map((c) => {
                    const pct = totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0
                    const w = max > 0 ? (c.total / max) * 100 : 0
                    return (
                      <div key={c.code + c.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-[140px]" title={c.name}>{c.name}</span>
                          <span className="text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-rose-500" style={{ width: `${w}%` }} />
                        </div>
                        <div className="text-[10px] text-right text-muted-foreground tabular-nums">{fmt(c.total)}</div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Задължения към доставчици (неплатени)</CardTitle></CardHeader>
        <CardContent>
          {unpaidList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Няма неплатени задължения.</p>
          ) : (
            <UnpaidSuppliersList items={unpaidList} total={unpaidTotal} invoiceCount={unpaid.length} />
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <RevenueDashboard defaultFrom={defFrom} defaultTo={defTo} propertyId={id} userRole={user?.role} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
