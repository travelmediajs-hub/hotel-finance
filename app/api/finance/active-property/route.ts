import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_PROPERTY_COOKIE, getFinanceUser, isCORole } from '@/lib/finance/auth'

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // CO roles see everything — no active property scoping needed
  if (isCORole(user.role)) {
    return NextResponse.json({ error: 'not_applicable' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const propertyId = (body.property_id ?? null) as string | null

  const cookieStore = await cookies()

  if (!propertyId) {
    cookieStore.delete(ACTIVE_PROPERTY_COOKIE)
    return NextResponse.json({ property_id: null })
  }

  // Verify the property is in the user's access list
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_property_access')
    .select('property_id')
    .eq('user_id', user.id)
    .eq('property_id', propertyId)
    .maybeSingle()

  if (!data) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Нямате достъп до този обект' },
      { status: 403 }
    )
  }

  cookieStore.set(ACTIVE_PROPERTY_COOKIE, propertyId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return NextResponse.json({ property_id: propertyId })
}
