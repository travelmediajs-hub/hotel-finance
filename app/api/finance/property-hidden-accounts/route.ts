import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

// GET — list hidden account IDs for a property
export async function GET(req: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const propertyId = req.nextUrl.searchParams.get('property_id')
  if (!propertyId) return NextResponse.json({ error: 'property_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('property_hidden_accounts')
    .select('account_id')
    .eq('property_id', propertyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data.map(r => r.account_id))
}

// POST — toggle: hide or unhide an account for a property
export async function POST(req: NextRequest) {
  const user = await getFinanceUser()
  if (!user || user.realRole !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { property_id, account_id, hidden } = body

  if (!property_id || !account_id || typeof hidden !== 'boolean') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const supabase = await createClient()

  if (hidden) {
    const { error } = await supabase
      .from('property_hidden_accounts')
      .upsert({ property_id, account_id }, { onConflict: 'property_id,account_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('property_hidden_accounts')
      .delete()
      .eq('property_id', property_id)
      .eq('account_id', account_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
