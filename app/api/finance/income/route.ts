import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { createIncomeEntrySchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const propertyId = searchParams.get('property_id')
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const accountId = searchParams.get('account_id')

  let query = supabase
    .from('income_entries')
    .select('*, properties(name), usali_accounts(code, name)')
    .order('entry_date', { ascending: false })
    .limit(200)

  const accessibleIds = await getUserPropertyIds(user)
  if (accessibleIds !== null) {
    if (propertyId) {
      query = query.eq('property_id', propertyId)
    } else {
      if (accessibleIds.length === 0) {
        return NextResponse.json([])
      }
      query = query.in('property_id', accessibleIds)
    }
  } else {
    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }
  }

  if (status) {
    query = query.eq('status', status)
  }
  if (type) {
    query = query.eq('type', type)
  }
  if (accountId) {
    query = query.eq('account_id', accountId)
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

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = await createIncomeEntrySchema.safeParseAsync(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const status = parsed.data.type === 'INC_ADV' ? 'ADVANCE' : 'ENTERED'

  const { data, error } = await supabase
    .from('income_entries')
    .insert({
      ...parsed.data,
      created_by_id: user.id,
      status,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
