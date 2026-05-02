import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { createExpenseSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const propertyId = searchParams.get('property_id')
  const status = searchParams.get('status')
  const accountId = searchParams.get('account_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let query = supabase
    .from('expenses')
    .select('*, departments(name), properties(name), usali_accounts(code, name)')
    .order('issue_date', { ascending: false })
    .limit(200)

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (accountId) {
    query = query.eq('account_id', accountId)
  }
  if (dateFrom) {
    query = query.gte('issue_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('issue_date', dateTo)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN_CO' && user.role !== 'FINANCE_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = await createExpenseSchema.safeParseAsync(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Apply sign convention: credit notes are stored as negative amounts so they
  // offset invoices in aggregations. Input is always positive (validated by
  // schema); server is the single source of truth for the sign.
  if (parsed.data.document_type === 'CREDIT_NOTE') {
    parsed.data.amount_net = -Math.abs(parsed.data.amount_net)
    parsed.data.vat_amount = -Math.abs(parsed.data.vat_amount)
  }

  // Build insert object, excluding null optional fields that may not be in schema cache
  const { bank_account_id, co_cash_id, department_id, supplier, supplier_eik, document_number, attachment_url, note, ...requiredFields } = parsed.data
  // All new expenses enter as UNPAID; only admin marks them as paid via the pay endpoint.
  const insertData: Record<string, unknown> = {
    ...requiredFields,
    created_by_id: user.id,
    status: 'UNPAID',
    paid_amount: 0,
  }
  if (bank_account_id) insertData.bank_account_id = bank_account_id
  if (co_cash_id) insertData.co_cash_id = co_cash_id
  if (department_id) insertData.department_id = department_id
  if (supplier) insertData.supplier = supplier
  if (supplier_eik) insertData.supplier_eik = supplier_eik
  if (document_number) insertData.document_number = document_number
  if (attachment_url) insertData.attachment_url = attachment_url
  if (note) insertData.note = note

  // Manager paying in cash: the cash has already left the property's register,
  // so mark the expense PAID immediately. CO audits afterwards (RETURN/REJECT/edit).
  // The property_cash_balances view ties expenses to the register via property_id,
  // so no register reference is stored on the expense itself.
  if (user.role === 'MANAGER' && parsed.data.payment_method === 'CASH') {
    const { data: register } = await supabase
      .from('property_cash_registers')
      .select('id')
      .eq('property_id', parsed.data.property_id)
      .maybeSingle()

    if (!register) {
      return NextResponse.json(
        { error: 'no_cash_register', message: 'Обектът няма каса' },
        { status: 400 }
      )
    }

    insertData.status = 'PAID'
    insertData.paid_amount = parsed.data.amount_net + parsed.data.vat_amount
    insertData.paid_at = parsed.data.issue_date
    insertData.paid_by_id = user.id
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error', message: error.message, details: error.details }, { status: 500 })
  }

  // Auto-create bank transaction when expense uses bank transfer.
  // Skip for credit notes — they offset an invoice and rarely involve a real payment.
  if (
    parsed.data.bank_account_id &&
    parsed.data.payment_method === 'BANK_TRANSFER' &&
    parsed.data.document_type !== 'CREDIT_NOTE'
  ) {
    const supplier = parsed.data.supplier_id
      ? (await supabase.from('suppliers').select('name').eq('id', parsed.data.supplier_id).single()).data?.name
      : null
    await supabase.from('bank_transactions').insert({
      bank_account_id: parsed.data.bank_account_id,
      transaction_date: parsed.data.issue_date,
      direction: 'OUT',
      amount: parsed.data.amount_net + parsed.data.vat_amount,
      counterparty: supplier ?? 'Разход',
      type: 'OUT_INVOICE',
      property_id: parsed.data.property_id,
      expense_id: data.id,
      note: parsed.data.document_number ? `Фактура ${parsed.data.document_number}` : null,
      created_by_id: user.id,
    })
  }

  return NextResponse.json(data, { status: 201 })
}
