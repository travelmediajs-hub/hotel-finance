import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { createUsaliAccountSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const templateId = searchParams.get('template_id')
  const accountType = searchParams.get('account_type')
  const level = searchParams.get('level')
  const activeOnly = searchParams.get('active_only') !== 'false'

  let query = supabase
    .from('usali_accounts')
    .select('*, usali_department_templates(code, name, category)')
    .order('sort_order')

  if (activeOnly) {
    query = query.eq('is_active', true)
  }
  if (templateId) {
    query = query.eq('template_id', templateId)
  }
  if (accountType) {
    query = query.eq('account_type', accountType)
  }
  if (level) {
    query = query.eq('level', parseInt(level))
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

  if (user.realRole !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createUsaliAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usali_accounts')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Код на сметката вече съществува' }, { status: 409 })
    }
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
