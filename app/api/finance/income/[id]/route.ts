import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { updateIncomeEntrySchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: entry, error: fetchError } = await supabase
    .from('income_entries')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !entry) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Editable except after realization
  const editableStatuses = ['ENTERED', 'CONFIRMED', 'ADVANCE']
  if (!editableStatuses.includes(entry.status)) {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Приходът не може да се редактира след реализиране' },
      { status: 400 }
    )
  }

  const body = await request.json()
  const parsed = updateIncomeEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Apply sign convention based on the effective type after this update.
  const effectiveType = parsed.data.type ?? entry.type
  if (effectiveType === 'INC_CREDIT_NOTE' && parsed.data.amount !== undefined) {
    parsed.data.amount = -Math.abs(parsed.data.amount)
  }

  const { data, error } = await supabase
    .from('income_entries')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('income_entries')
    .select(
      '*, properties(name), bank_accounts(name, iban), loans(bank, amount), usali_accounts(code, name)'
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
