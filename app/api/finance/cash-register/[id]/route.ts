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
