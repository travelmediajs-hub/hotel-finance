import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { payExpenseSchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = payExpenseSchema.safeParse({ ...body, expense_id: id })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Fetch the expense
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !expense) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const payableStatuses = ['APPROVED', 'PARTIAL', 'UNPAID', 'OVERDUE']
  if (!payableStatuses.includes(expense.status)) {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Разходът не е в състояние, което позволява плащане' },
      { status: 400 }
    )
  }

  // Enforce payment source based on expense payment method
  if (expense.payment_method === 'CASH' && !parsed.data.cash_register_id) {
    return NextResponse.json(
      { error: 'missing_source', message: 'Касата е задължителна при плащане в брой' },
      { status: 400 }
    )
  }
  if (expense.payment_method === 'BANK_TRANSFER' && !parsed.data.bank_account_id) {
    return NextResponse.json(
      { error: 'missing_source', message: 'Банковата сметка е задължителна при банков превод' },
      { status: 400 }
    )
  }

  // total_amount is a generated column: amount_net + vat_amount
  const totalAmount = Number(expense.amount_net) + Number(expense.vat_amount)
  const newPaidAmount = Number(expense.paid_amount) + parsed.data.paid_amount
  const newStatus = newPaidAmount >= totalAmount ? 'PAID' : 'PARTIAL'

  const updateData: Record<string, unknown> = {
    paid_amount: newPaidAmount,
    paid_at: parsed.data.paid_at,
    paid_by_id: user.id,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.paid_from_cash !== undefined) {
    updateData.paid_from_cash = parsed.data.paid_from_cash
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
