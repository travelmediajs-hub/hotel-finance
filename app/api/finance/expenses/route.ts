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

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN_CO') {
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

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      ...parsed.data,
      created_by_id: user.id,
      status: 'DRAFT',
      paid_amount: 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
