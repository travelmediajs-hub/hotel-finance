import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface KpiSet {
  roomsAvailable: number
  roomsSold: number
  guests: number
  occupancyPercent: number
  adr: number
  revpar: number
  totalRevenuePerRoom: number
  roomRevenue: number
  totalRevenue: number
}

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const year = parseInt(searchParams.get('year') ?? '')
  const month = parseInt(searchParams.get('month') ?? '')

  if (!propertyId || !year || !month) {
    return NextResponse.json({ error: 'property_id, year, month required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: roomsTemplate } = await supabase
    .from('usali_department_templates')
    .select('id')
    .eq('code', 'ROOMS')
    .single()

  const roomsTemplateId = roomsTemplate?.id
  const { data: roomAccounts } = await supabase
    .from('usali_accounts')
    .select('id')
    .eq('template_id', roomsTemplateId ?? '')
    .eq('account_type', 'REVENUE')
    .eq('level', 3)
    .eq('is_active', true)

  const roomAccountIds = (roomAccounts ?? []).map(a => a.id)

  async function computeKpis(y: number, m: number): Promise<KpiSet | null> {
    const dateFrom = `${y}-${String(m).padStart(2, '0')}-01`
    const dateTo = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`

    const { data: stats } = await supabase
      .from('property_statistics')
      .select('rooms_available, rooms_sold, guests')
      .eq('property_id', propertyId!)
      .gte('date', dateFrom)
      .lt('date', dateTo)

    const roomsAvailable = (stats ?? []).reduce((s, r) => s + r.rooms_available, 0)
    const roomsSold = (stats ?? []).reduce((s, r) => s + r.rooms_sold, 0)
    const guests = (stats ?? []).reduce((s, r) => s + r.guests, 0)

    if (roomsAvailable === 0) return null

    let roomRevQuery = supabase
      .from('income_entries')
      .select('amount')
      .eq('property_id', propertyId!)
      .gte('entry_date', dateFrom)
      .lt('entry_date', dateTo)

    if (roomAccountIds.length > 0) {
      roomRevQuery = roomRevQuery.in('account_id', roomAccountIds)
    }

    const { data: roomRevRows } = await roomRevQuery
    const roomRevenue = (roomRevRows ?? []).reduce((s, r) => s + Number(r.amount), 0)

    const { data: totalRevRows } = await supabase
      .from('income_entries')
      .select('amount')
      .eq('property_id', propertyId!)
      .gte('entry_date', dateFrom)
      .lt('entry_date', dateTo)

    const totalRevenue = (totalRevRows ?? []).reduce((s, r) => s + Number(r.amount), 0)

    return {
      roomsAvailable,
      roomsSold,
      guests,
      occupancyPercent: (roomsSold / roomsAvailable) * 100,
      adr: roomsSold > 0 ? roomRevenue / roomsSold : 0,
      revpar: roomRevenue / roomsAvailable,
      totalRevenuePerRoom: totalRevenue / roomsAvailable,
      roomRevenue,
      totalRevenue,
    }
  }

  const current = await computeKpis(year, month)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevMonthYear = month === 1 ? year - 1 : year
  const previousMonth = await computeKpis(prevMonthYear, prevMonth)
  const previousYear = await computeKpis(year - 1, month)

  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .single()

  return NextResponse.json({
    property: property ?? { id: propertyId, name: '' },
    period: { year, month },
    current,
    previousMonth,
    previousYear,
  })
}
