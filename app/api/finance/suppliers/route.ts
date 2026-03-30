import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function GET(req: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const activeOnly = req.nextUrl.searchParams.get('active_only') !== 'false'
  let query = supabase
    .from('suppliers')
    .select('id, name, eik, vat_number, contact_person, phone, email, is_active')
    .order('name')

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getFinanceUser()
  if (!user || !['ADMIN_CO', 'FINANCE_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, eik, vat_number, address, contact_person, phone, email, iban, notes } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Името е задължително' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: name.trim(),
      eik: eik?.trim() || null,
      vat_number: vat_number?.trim() || null,
      address: address?.trim() || null,
      contact_person: contact_person?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      iban: iban?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
