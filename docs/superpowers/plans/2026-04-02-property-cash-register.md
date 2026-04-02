# Property Cash Register (Каса на обект) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cash register per property that shows real-time balance from income, withdrawals, collections, received funds, and transfers.

**Architecture:** New `property_cash_registers` table auto-created with each property. A SQL view computes balance from all cash-affecting tables. API endpoint returns balance + unified movement list. UI page with property selector and movements table.

**Tech Stack:** Supabase (Postgres migration + RLS), Next.js API routes, React client components, shadcn/ui

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260402000000_create_property_cash_registers.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Property cash registers: one per property, auto-created
CREATE TABLE property_cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  opening_balance decimal(12,2) NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_cash_registers_property_id_key UNIQUE (property_id)
);

CREATE INDEX idx_property_cash_registers_property ON property_cash_registers (property_id);

-- RLS
ALTER TABLE property_cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_cash_registers_select ON property_cash_registers
  FOR SELECT USING (true);

CREATE POLICY property_cash_registers_insert ON property_cash_registers
  FOR INSERT WITH CHECK (true);

CREATE POLICY property_cash_registers_update ON property_cash_registers
  FOR UPDATE USING (true);

-- View: property cash balance
CREATE OR REPLACE VIEW property_cash_balances AS
SELECT
  pcr.id,
  pcr.property_id,
  pcr.name,
  pcr.opening_balance,
  pcr.opening_balance_date,
  pcr.opening_balance
    -- Daily report cash revenue (APPROVED/CORRECTED reports only)
    + COALESCE((
      SELECT SUM(drl.cash_net)
      FROM daily_report_lines drl
      JOIN daily_reports dr ON dr.id = drl.daily_report_id
      WHERE dr.property_id = pcr.property_id
        AND dr.status IN ('APPROVED', 'CORRECTED')
        AND dr.date >= pcr.opening_balance_date
    ), 0)
    -- Withdrawals (APPROVED or ACCOUNTED, not voided)
    - COALESCE((
      SELECT SUM(w.amount)
      FROM withdrawals w
      WHERE w.property_id = pcr.property_id
        AND w.status IN ('APPROVED', 'ACCOUNTED')
        AND w.is_void = false
        AND w.withdrawal_date::date >= pcr.opening_balance_date
    ), 0)
    -- Cash collections sent to CO
    - COALESCE((
      SELECT SUM(cc.amount)
      FROM cash_collections cc
      WHERE cc.property_id = pcr.property_id
        AND cc.status IN ('SENT', 'RECEIVED', 'ACCOUNTED')
        AND cc.collection_date >= pcr.opening_balance_date
    ), 0)
    -- Money received from CO
    + COALESCE((
      SELECT SUM(mr.amount)
      FROM money_received mr
      WHERE mr.property_id = pcr.property_id
        AND mr.status IN ('RECEIVED', 'ACCOUNTED')
        AND mr.sent_date >= pcr.opening_balance_date
    ), 0)
    -- In-transit arriving TO this property
    + COALESCE((
      SELECT SUM(it.total_amount)
      FROM in_transits it
      WHERE it.destination_type = 'PROPERTY_CASH'
        AND it.destination_id = pcr.property_id
        AND it.status = 'CLOSED'
        AND it.start_date_time::date >= pcr.opening_balance_date
    ), 0)
    -- In-transit leaving FROM this property
    - COALESCE((
      SELECT SUM(its.amount)
      FROM in_transit_sources its
      JOIN in_transits it ON it.id = its.in_transit_id
      WHERE its.source_type = 'PROPERTY_CASH'
        AND its.source_id = pcr.property_id
        AND it.status = 'CLOSED'
        AND it.start_date_time::date >= pcr.opening_balance_date
    ), 0)
  AS current_balance
FROM property_cash_registers pcr;

-- Auto-create cash registers for existing properties
INSERT INTO property_cash_registers (property_id, name, opening_balance, opening_balance_date)
SELECT p.id, 'Каса ' || p.name, 0, CURRENT_DATE
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM property_cash_registers pcr WHERE pcr.property_id = p.id
);

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Apply migration**

Run migration via Supabase dashboard or CLI.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260402000000_create_property_cash_registers.sql
git commit -m "feat: add property_cash_registers table and balance view"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `types/finance.ts`

- [ ] **Step 1: Add types at the end of the file**

```typescript
export interface PropertyCashRegister {
  id: string
  property_id: string
  name: string
  opening_balance: number
  opening_balance_date: string
  created_at: string
}

export interface PropertyCashBalance {
  id: string
  property_id: string
  name: string
  opening_balance: number
  opening_balance_date: string
  current_balance: number
}

export type CashMovementType = 'daily_report' | 'withdrawal' | 'cash_collection' | 'money_received' | 'transfer_in' | 'transfer_out'

export interface CashMovement {
  date: string
  type: CashMovementType
  description: string
  income: number | null
  expense: number | null
  reference_id: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/finance.ts
git commit -m "feat: add PropertyCashRegister and CashMovement types"
```

---

### Task 3: Auto-create Cash Register on Property Creation

**Files:**
- Modify: `app/api/finance/properties/route.ts`

- [ ] **Step 1: Add cash register creation after property insert**

In the POST handler, after the successful property insert and before the return, add:

```typescript
  // Auto-create cash register for the new property
  await supabase
    .from('property_cash_registers')
    .insert({
      property_id: data.id,
      name: `Каса ${data.name}`,
      opening_balance: 0,
      opening_balance_date: new Date().toISOString().split('T')[0],
    })
```

Insert this block after `if (error) { ... }` and before `return NextResponse.json(data, { status: 201 })`.

- [ ] **Step 2: Commit**

```bash
git add app/api/finance/properties/route.ts
git commit -m "feat: auto-create cash register when property is created"
```

---

### Task 4: Cash Register API Endpoint

**Files:**
- Create: `app/api/finance/cash-register/route.ts`
- Create: `app/api/finance/cash-register/[id]/route.ts`

- [ ] **Step 1: Create GET endpoint for balance + movements**

File: `app/api/finance/cash-register/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'

export async function GET(req: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('property_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  // Access control
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds !== null) {
    if (!propertyId || !allowedIds.includes(propertyId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const supabase = await createClient()

  // Get balance(s)
  let balanceQuery = supabase.from('property_cash_balances').select('*')
  if (propertyId) {
    balanceQuery = balanceQuery.eq('property_id', propertyId)
  }
  const { data: balances, error: balErr } = await balanceQuery
  if (balErr) {
    return NextResponse.json({ error: balErr.message }, { status: 500 })
  }

  if (!propertyId) {
    return NextResponse.json({ balances, movements: [] })
  }

  // Get register for date filtering
  const register = balances?.[0]
  if (!register) {
    return NextResponse.json({ balances: [], movements: [] })
  }

  const dateFrom = from || register.opening_balance_date
  const dateTo = to || '2099-12-31'

  // Fetch movements from all sources
  const [dailyRes, withdrawalRes, collectionRes, receivedRes, transitInRes, transitOutRes] = await Promise.all([
    // Daily reports cash
    supabase
      .from('daily_reports')
      .select('id, date, total_cash_net, daily_report_lines(cash_net, department_id, departments(name))')
      .eq('property_id', propertyId)
      .in('status', ['APPROVED', 'CORRECTED'])
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false }),

    // Withdrawals
    supabase
      .from('withdrawals')
      .select('id, withdrawal_date, amount, withdrawn_by, description, purpose')
      .eq('property_id', propertyId)
      .in('status', ['APPROVED', 'ACCOUNTED'])
      .eq('is_void', false)
      .gte('withdrawal_date', dateFrom)
      .lte('withdrawal_date', dateTo)
      .order('withdrawal_date', { ascending: false }),

    // Cash collections
    supabase
      .from('cash_collections')
      .select('id, collection_date, amount, note')
      .eq('property_id', propertyId)
      .in('status', ['SENT', 'RECEIVED', 'ACCOUNTED'])
      .gte('collection_date', dateFrom)
      .lte('collection_date', dateTo)
      .order('collection_date', { ascending: false }),

    // Money received
    supabase
      .from('money_received')
      .select('id, sent_date, amount, purpose, purpose_description')
      .eq('property_id', propertyId)
      .in('status', ['RECEIVED', 'ACCOUNTED'])
      .gte('sent_date', dateFrom)
      .lte('sent_date', dateTo)
      .order('sent_date', { ascending: false }),

    // In-transit arriving TO property
    supabase
      .from('in_transits')
      .select('id, start_date_time, total_amount, description')
      .eq('destination_type', 'PROPERTY_CASH')
      .eq('destination_id', propertyId)
      .eq('status', 'CLOSED')
      .gte('start_date_time', dateFrom)
      .lte('start_date_time', dateTo)
      .order('start_date_time', { ascending: false }),

    // In-transit leaving FROM property
    supabase
      .from('in_transit_sources')
      .select('id, amount, in_transits!inner(id, start_date_time, description, status)')
      .eq('source_type', 'PROPERTY_CASH')
      .eq('source_id', propertyId)
      .eq('in_transits.status', 'CLOSED')
      .gte('in_transits.start_date_time', dateFrom)
      .lte('in_transits.start_date_time', dateTo),
  ])

  // Build unified movements list
  type Movement = { date: string; type: string; description: string; income: number | null; expense: number | null; reference_id: string }
  const movements: Movement[] = []

  const purposeLabels: Record<string, string> = {
    PAY_EXP: 'Плащане разход', PAY_SAL: 'Заплата', ADV_EMP: 'Аванс служител',
    ADV_OPS: 'Аванс операт.', BANK_IN: 'Внос в банка', CASH_TRANS: 'Трансфер каса',
    CO_COLLECT: 'Инкасация ЦО', OTHER: 'Друго',
  }

  const receivedPurposeLabels: Record<string, string> = {
    OPERATIONAL: 'Оперативни', SALARIES: 'Заплати', CASH_SUPPLY: 'Захранване каса',
    SPECIFIC_GOAL: 'Целеви', ADVANCE: 'Аванс',
  }

  // Daily reports
  for (const dr of dailyRes.data ?? []) {
    if (dr.total_cash_net !== 0) {
      movements.push({
        date: dr.date,
        type: 'daily_report',
        description: `Дневен отчет ${dr.date}`,
        income: Number(dr.total_cash_net) > 0 ? Number(dr.total_cash_net) : null,
        expense: Number(dr.total_cash_net) < 0 ? Math.abs(Number(dr.total_cash_net)) : null,
        reference_id: dr.id,
      })
    }
  }

  // Withdrawals
  for (const w of withdrawalRes.data ?? []) {
    movements.push({
      date: typeof w.withdrawal_date === 'string' ? w.withdrawal_date.split('T')[0] : w.withdrawal_date,
      type: 'withdrawal',
      description: `${purposeLabels[w.purpose] ?? w.purpose} — ${w.withdrawn_by}${w.description ? ': ' + w.description : ''}`,
      income: null,
      expense: Number(w.amount),
      reference_id: w.id,
    })
  }

  // Cash collections
  for (const cc of collectionRes.data ?? []) {
    movements.push({
      date: cc.collection_date,
      type: 'cash_collection',
      description: `Инкасация${cc.note ? ': ' + cc.note : ''}`,
      income: null,
      expense: Number(cc.amount),
      reference_id: cc.id,
    })
  }

  // Money received
  for (const mr of receivedRes.data ?? []) {
    movements.push({
      date: mr.sent_date,
      type: 'money_received',
      description: `Получени средства — ${receivedPurposeLabels[mr.purpose] ?? mr.purpose}${mr.purpose_description ? ': ' + mr.purpose_description : ''}`,
      income: Number(mr.amount),
      expense: null,
      reference_id: mr.id,
    })
  }

  // Transfers in
  for (const t of transitInRes.data ?? []) {
    movements.push({
      date: typeof t.start_date_time === 'string' ? t.start_date_time.split('T')[0] : t.start_date_time,
      type: 'transfer_in',
      description: `Входящ трансфер: ${t.description}`,
      income: Number(t.total_amount),
      expense: null,
      reference_id: t.id,
    })
  }

  // Transfers out
  for (const ts of transitOutRes.data ?? []) {
    const it = ts.in_transits as any
    movements.push({
      date: typeof it.start_date_time === 'string' ? it.start_date_time.split('T')[0] : it.start_date_time,
      type: 'transfer_out',
      description: `Изходящ трансфер: ${it.description}`,
      income: null,
      expense: Number(ts.amount),
      reference_id: it.id,
    })
  }

  // Sort by date descending
  movements.sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ balances, movements })
}
```

- [ ] **Step 2: Create PATCH endpoint for editing opening balance**

File: `app/api/finance/cash-register/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getFinanceUser()
  if (!user || !['ADMIN_CO', 'FINANCE_CO'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { opening_balance, opening_balance_date, name } = body

  const updates: Record<string, unknown> = {}
  if (opening_balance !== undefined) updates.opening_balance = opening_balance
  if (opening_balance_date !== undefined) updates.opening_balance_date = opening_balance_date
  if (name !== undefined) updates.name = name

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('property_cash_registers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/cash-register/route.ts app/api/finance/cash-register/[id]/route.ts
git commit -m "feat: add cash register API endpoints"
```

---

### Task 5: Sidebar Navigation

**Files:**
- Modify: `components/finance/FinanceSidebar.tsx`

- [ ] **Step 1: Add Wallet import and nav item**

Add `Wallet` to the lucide-react import:

```typescript
import {
  Building2, LayoutDashboard, FileText, FileCheck, Receipt, Wallet,
  Landmark, ArrowRightLeft, TrendingUp,
  CalendarDays, Eye, Package, BookOpen, BarChart3, Users,
} from 'lucide-react'
```

Add the nav item after the expenses entry:

```typescript
  { href: '/finance/cash-register', label: 'Каса', icon: Wallet, roles: ['ADMIN_CO', 'FINANCE_CO', 'MANAGER'] },
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/FinanceSidebar.tsx
git commit -m "feat: add Каса nav item to sidebar"
```

---

### Task 6: Cash Register Page (Server Component)

**Files:**
- Create: `app/(finance)/finance/cash-register/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { CashRegisterView } from '@/components/finance/CashRegisterView'

export default async function CashRegisterPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Get accessible properties
  const allowedIds = await getUserPropertyIds(user)
  let propertiesQuery = supabase.from('properties').select('id, name').eq('status', 'ACTIVE').order('name')
  if (allowedIds !== null) {
    if (allowedIds.length === 0) {
      return <div className="p-6 text-muted-foreground">Нямате достъп до обекти</div>
    }
    propertiesQuery = propertiesQuery.in('id', allowedIds)
  }
  const { data: properties } = await propertiesQuery

  // Get all cash balances
  let balancesQuery = supabase.from('property_cash_balances').select('*')
  if (allowedIds !== null) {
    balancesQuery = balancesQuery.in('property_id', allowedIds)
  }
  const { data: balances } = await balancesQuery

  const canEdit = user.role === 'ADMIN_CO' || user.role === 'FINANCE_CO'
  const singleProperty = allowedIds !== null && allowedIds.length === 1

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <CashRegisterView
        properties={properties ?? []}
        balances={balances ?? []}
        canEdit={canEdit}
        defaultPropertyId={singleProperty ? allowedIds![0] : undefined}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(finance)/finance/cash-register/page.tsx"
git commit -m "feat: add cash register server page"
```

---

### Task 7: Cash Register Client Component

**Files:**
- Create: `components/finance/CashRegisterView.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Pencil } from 'lucide-react'
import type { PropertyCashBalance, CashMovement } from '@/types/finance'

interface Props {
  properties: { id: string; name: string }[]
  balances: PropertyCashBalance[]
  canEdit: boolean
  defaultPropertyId?: string
}

const typeLabels: Record<string, string> = {
  daily_report: 'Дневен отчет',
  withdrawal: 'Теглене',
  cash_collection: 'Инкасация',
  money_received: 'Получени средства',
  transfer_in: 'Входящ трансфер',
  transfer_out: 'Изходящ трансфер',
}

const typeBadgeVariants: Record<string, string> = {
  daily_report: 'bg-green-600/20 text-green-400 border-green-600/30',
  withdrawal: 'bg-red-600/20 text-red-400 border-red-600/30',
  cash_collection: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  money_received: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  transfer_in: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  transfer_out: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
}

function fmt(n: number | null) {
  if (n === null || n === 0) return '—'
  return n.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CashRegisterView({ properties, balances, canEdit, defaultPropertyId }: Props) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? '')
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Edit sheet state
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ opening_balance: '', opening_balance_date: '', name: '' })
  const [saving, setSaving] = useState(false)

  const balance = balances.find(b => b.property_id === propertyId)

  const loadMovements = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ property_id: propertyId })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/finance/cash-register?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [propertyId, from, to])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  function openEdit() {
    if (!balance) return
    setEditForm({
      opening_balance: String(balance.opening_balance),
      opening_balance_date: balance.opening_balance_date,
      name: balance.name,
    })
    setEditOpen(true)
  }

  async function handleSave() {
    if (!balance) return
    setSaving(true)
    try {
      const res = await fetch(`/api/finance/cash-register/${balance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_balance: parseFloat(editForm.opening_balance) || 0,
          opening_balance_date: editForm.opening_balance_date,
          name: editForm.name,
        }),
      })
      if (res.ok) {
        setEditOpen(false)
        window.location.reload()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Каса</CardTitle>
            {properties.length > 1 && (
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="w-[250px] h-8 text-sm">
                  <SelectValue placeholder="Изберете обект" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Balance display */}
          {balance && (
            <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{balance.name}</p>
                <p className={`text-2xl font-bold ${balance.current_balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {fmt(balance.current_balance)} лв.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Начално салдо: {fmt(balance.opening_balance)} лв. от {balance.opening_balance_date}
                </p>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Редакция
                </Button>
              )}
            </div>
          )}

          {!balance && propertyId && (
            <p className="text-sm text-muted-foreground mb-4">Няма каса за този обект</p>
          )}

          {/* Date filters */}
          <div className="flex items-end gap-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">От</Label>
              <Input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="h-8 text-sm w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">До</Label>
              <Input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="h-8 text-sm w-[150px]"
              />
            </div>
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>
                Изчисти
              </Button>
            )}
          </div>

          {/* Movements table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium w-[100px]">Дата</th>
                  <th className="text-left px-3 py-2 font-medium w-[140px]">Тип</th>
                  <th className="text-left px-3 py-2 font-medium">Описание</th>
                  <th className="text-right px-3 py-2 font-medium w-[110px]">Приход</th>
                  <th className="text-right px-3 py-2 font-medium w-[110px]">Разход</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Зареждане...</td></tr>
                )}
                {!loading && movements.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Няма движения</td></tr>
                )}
                {!loading && movements.map((m, i) => (
                  <tr key={`${m.reference_id}-${i}`} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{m.date}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeBadgeVariants[m.type] ?? ''}`}>
                        {typeLabels[m.type] ?? m.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{m.description}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-500">{m.income ? fmt(m.income) : ''}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-500">{m.expense ? fmt(m.expense) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit opening balance sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>Редакция на каса</SheetTitle>
            <SheetDescription>Променете началното салдо и датата</SheetDescription>
          </SheetHeader>
          <div className="px-4 space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Име</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Начално салдо</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.opening_balance}
                onChange={e => setEditForm(f => ({ ...f, opening_balance: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Дата на начално салдо</Label>
              <Input
                type="date"
                value={editForm.opening_balance_date}
                onChange={e => setEditForm(f => ({ ...f, opening_balance_date: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button disabled={saving} onClick={handleSave} className="w-full">
              {saving ? 'Запис...' : 'Запази'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/CashRegisterView.tsx
git commit -m "feat: add CashRegisterView client component"
```

---

### Task 8: Final Integration & Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build passes with no errors.

- [ ] **Step 2: Final commit with all files**

```bash
git add -A
git commit -m "feat: property cash register - complete implementation"
```
