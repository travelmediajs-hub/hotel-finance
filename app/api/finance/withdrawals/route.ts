import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createWithdrawalSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const propertyId = searchParams.get('property_id')
  const status = searchParams.get('status')
  const purpose = searchParams.get('purpose')

  let query = supabase
    .from('withdrawals')
    .select('*, properties(name)')
    .order('withdrawal_date', { ascending: false })
    .limit(200)

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (purpose) {
    query = query.eq('purpose', purpose)
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

  if (user.role !== 'MANAGER' && user.role !== 'DEPT_HEAD' && user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = await createWithdrawalSchema.safeParseAsync(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Determine status based on role and amount
  let status: string
  if (user.role === 'ADMIN_CO') {
    status = 'RECORDED'
  } else if (user.role === 'MANAGER') {
    status = parsed.data.amount <= 200 ? 'RECORDED' : 'PENDING_APPROVAL'
  } else {
    // DEPT_HEAD
    status = parsed.data.amount <= 100 ? 'RECORDED' : 'PENDING_APPROVAL'
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('withdrawals')
    .insert({
      ...parsed.data,
      authorized_by_id: user.id,
      status,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
