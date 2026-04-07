import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export const dynamic = 'force-dynamic'

// GET /api/creato/forecast?propertyId=...&rooms=20
// Връща on-the-books прогноза за 30/60/90 дни напред + Same-Time-Last-Year (STLY).
export async function GET(req: Request) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('propertyId')
  const rooms = parseInt(searchParams.get('rooms') || '20')

  const supabase = await createClient()

  async function fetchRange(fromIso: string, toIso: string) {
    const PAGE = 1000
    const all: any[] = []
    for (let offset = 0; ; offset += PAGE) {
      let q = supabase
        .from('pms_reservations')
        .select('from_date,to_date,days,total_eur,status')
        .lte('from_date', toIso)
        .gte('to_date', fromIso)
        .in('status', ['OK', 'OUT', 'IN'])
        .order('from_date', { ascending: true })
        .range(offset, offset + PAGE - 1)
      if (propertyId) q = q.eq('property_id', propertyId)
      const { data, error } = await q
      if (error) throw error
      const rows = data ?? []
      all.push(...rows)
      if (rows.length < PAGE) break
      if (offset > 50000) break
    }
    return all
  }

  function computeWindow(rows: any[], from: Date, to: Date) {
    let nights = 0
    let revenue = 0
    for (const r of rows) {
      const td = parseInt(String(r.days || 0))
      if (!td || !r.from_date || !r.to_date) continue
      const rpn = (parseFloat(String(r.total_eur || 0)) || 0) / td
      const start = new Date(Math.max(+new Date(r.from_date), +from))
      const end = new Date(Math.min(+new Date(r.to_date), +to))
      const cur = new Date(start)
      while (cur < end) {
        nights++
        revenue += rpn
        cur.setDate(cur.getDate() + 1)
      }
    }
    const days = Math.max(1, Math.round((+to - +from) / 86400000))
    const avail = rooms * days
    return {
      nights,
      revenue: Math.round(revenue * 100) / 100,
      occupancy: avail > 0 ? (nights / avail) * 100 : 0,
      adr: nights > 0 ? revenue / nights : 0,
      revpar: avail > 0 ? revenue / avail : 0,
      days,
    }
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const horizons = [30, 60, 90]
    const maxDays = Math.max(...horizons)
    const horizonEnd = new Date(today)
    horizonEnd.setDate(horizonEnd.getDate() + maxDays)

    // Fetch on-the-books
    const otb = await fetchRange(today.toISOString().slice(0, 10), horizonEnd.toISOString().slice(0, 10))

    // Fetch STLY (същия период миналата година)
    const stlyFrom = new Date(today)
    stlyFrom.setFullYear(stlyFrom.getFullYear() - 1)
    const stlyTo = new Date(horizonEnd)
    stlyTo.setFullYear(stlyTo.getFullYear() - 1)
    const stly = await fetchRange(stlyFrom.toISOString().slice(0, 10), stlyTo.toISOString().slice(0, 10))

    const result = horizons.map((d) => {
      const winEnd = new Date(today)
      winEnd.setDate(winEnd.getDate() + d)
      const stlyWinFrom = new Date(today)
      stlyWinFrom.setFullYear(stlyWinFrom.getFullYear() - 1)
      const stlyWinEnd = new Date(winEnd)
      stlyWinEnd.setFullYear(stlyWinEnd.getFullYear() - 1)
      return {
        days: d,
        otb: computeWindow(otb, today, winEnd),
        stly: computeWindow(stly, stlyWinFrom, stlyWinEnd),
      }
    })

    return NextResponse.json({ horizons: result, rooms })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'forecast failed' }, { status: 500 })
  }
}
