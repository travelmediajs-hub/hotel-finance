import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { budgetBatchSchema, budgetQuerySchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.view')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = budgetQuerySchema.safeParse(params)
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(parsed.data.property_id))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('opreport_budgets')
    .select('row_id, month, amount, opreport_rows!inner(row_key)')
    .eq('property_id', parsed.data.property_id)
    .eq('year', parsed.data.year)

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  const matrix: Record<string, Record<number, number>> = {}
  for (const b of data ?? []) {
    const row = b as unknown as {
      month: number
      amount: number
      opreport_rows: { row_key: string } | { row_key: string }[]
    }
    const rel = row.opreport_rows
    const key = Array.isArray(rel) ? rel[0]?.row_key : rel?.row_key
    if (!key) continue
    matrix[key] ??= {}
    matrix[key][row.month] = Number(row.amount)
  }
  return NextResponse.json({
    property_id: parsed.data.property_id,
    year: parsed.data.year,
    cells: matrix,
  })
}

export async function PUT(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.edit_budget')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = budgetBatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds) {
    for (const c of parsed.data.cells) {
      if (!allowedIds.includes(c.property_id))
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const supabase = await createClient()

  const uniqueKeys = Array.from(new Set(parsed.data.cells.map(c => c.row_key)))
  const { data: rows, error: rowsErr } = await supabase
    .from('opreport_rows')
    .select('id, row_key, budgetable')
    .in('row_key', uniqueKeys)
  if (rowsErr) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  const rowMap = new Map((rows ?? []).map(r => [r.row_key as string, r as { id: string; row_key: string; budgetable: boolean }]))
  for (const c of parsed.data.cells) {
    const row = rowMap.get(c.row_key)
    if (!row) return NextResponse.json({ error: `unknown row_key: ${c.row_key}` }, { status: 400 })
    if (!row.budgetable) return NextResponse.json({ error: `row_key not budgetable: ${c.row_key}` }, { status: 400 })
  }

  const payload = parsed.data.cells.map(c => ({
    property_id: c.property_id,
    year: c.year,
    month: c.month,
    row_id: rowMap.get(c.row_key)!.id,
    amount: c.amount,
  }))

  const { error: upErr } = await supabase
    .from('opreport_budgets')
    .upsert(payload, { onConflict: 'property_id,year,month,row_id' })
  if (upErr) return NextResponse.json({ error: 'database_error', detail: upErr.message }, { status: 500 })

  revalidatePath('/finance/usali-reports')
  return NextResponse.json({ success: true, saved: payload.length })
}
