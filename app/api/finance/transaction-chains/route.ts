import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createTransactionChainSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')

  let query = supabase
    .from('transaction_chains')
    .select(`
      *,
      initiated_by:user_profiles!initiated_by_id(id, full_name)
    `)
    .order('chain_date', { ascending: false })
    .limit(100)

  if (status) {
    query = query.eq('status', status)
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
  const parsed = createTransactionChainSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { steps, ...chainData } = parsed.data
  const supabase = await createClient()

  const { data: chain, error: insertError } = await supabase
    .from('transaction_chains')
    .insert({
      ...chainData,
      initiated_by_id: user.id,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const stepsPayload = steps.map((s) => ({
    ...s,
    chain_id: chain.id,
  }))

  const { error: stepsError } = await supabase
    .from('transaction_chain_steps')
    .insert(stepsPayload)

  if (stepsError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(chain, { status: 201 })
}
