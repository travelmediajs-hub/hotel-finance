import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { updateExpenseSchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('*, departments(name), properties(name)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Fetch existing expense
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !expense) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const isCO = user.role === 'ADMIN_CO' || user.role === 'FINANCE_CO'

  // Only creator or CO roles can update
  if (expense.created_by_id !== user.id && !isCO) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // CO roles can edit until paid; owners only DRAFT/RETURNED.
  // Cash expenses are an exception: PAID cash is editable so technical
  // mistakes (wrong amount, doc number) can be corrected without reversal.
  const isCashPaid = expense.payment_method === 'CASH' && expense.status === 'PAID'
  const editableForCO = !['PAID', 'PARTIAL', 'REJECTED'].includes(expense.status) || isCashPaid
  const editableForOwner = expense.status === 'DRAFT' || expense.status === 'RETURNED' || isCashPaid
  if (isCO ? !editableForCO : !editableForOwner) {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Разходът не може да се редактира в този статус' },
      { status: 400 }
    )
  }

  const body = await request.json()
  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // For paid cash expenses, sync paid_amount with edited net/vat so the
  // property cash register view reflects the corrected total.
  const updateFields: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }
  if (
    isCashPaid &&
    (parsed.data.amount_net !== undefined || parsed.data.vat_amount !== undefined)
  ) {
    const newNet = parsed.data.amount_net ?? Number(expense.amount_net)
    const newVat = parsed.data.vat_amount ?? Number(expense.vat_amount)
    updateFields.paid_amount = newNet + newVat
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
