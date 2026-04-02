import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getFinanceUser()
  if (!user || !['ADMIN_CO', 'FINANCE_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, eik, vat_number, contact_person, phone, email, address, iban, notes, is_active } = body

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: 'Името е задължително' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (eik !== undefined) updates.eik = eik?.trim() || null
  if (vat_number !== undefined) updates.vat_number = vat_number?.trim() || null
  if (contact_person !== undefined) updates.contact_person = contact_person?.trim() || null
  if (phone !== undefined) updates.phone = phone?.trim() || null
  if (email !== undefined) updates.email = email?.trim() || null
  if (address !== undefined) updates.address = address?.trim() || null
  if (iban !== undefined) updates.iban = iban?.trim() || null
  if (notes !== undefined) updates.notes = notes?.trim() || null
  if (is_active !== undefined) updates.is_active = is_active

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
