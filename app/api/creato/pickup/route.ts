import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export const dynamic = 'force-dynamic'

// GET /api/creato/pickup?from=...&to=...&days=7&propertyId=...
// Връща pickup за избрания период:
//   current  = сума от най-новия snapshot за stay_date в [from..to]
//   prior    = сума от snapshot отпреди `days` дни (или най-близкия преди това)
//   delta    = current - prior (нощи, приход, резервации)
export async function GET(req: Request) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const days = parseInt(searchParams.get('days') || '7')
  const propertyId = searchParams.get('propertyId')
  if (!from || !to) {
    return NextResponse.json({ error: 'missing from/to' }, { status: 400 })
  }

  const supabase = await createClient()

  async function snapshotAt(targetDate: string) {
    let q = supabase
      .from('pms_pickup_snapshots')
      .select('snapshot_date,stay_date,nights,revenue_eur,reservations')
      .gte('stay_date', from)
      .lte('stay_date', to)
      .lte('snapshot_date', targetDate)
      .order('snapshot_date', { ascending: false })
      .limit(10000)
    if (propertyId) q = q.eq('property_id', propertyId)
    const { data, error } = await q
    if (error) throw error
    // За всеки stay_date, вземи реда с най-голяма snapshot_date ≤ target
    const byStay: Record<string, any> = {}
    for (const r of data ?? []) {
      const k = r.stay_date as string
      if (!byStay[k]) byStay[k] = r
    }
    let nights = 0,
      revenue = 0,
      reservations = 0
    for (const r of Object.values(byStay) as any[]) {
      nights += r.nights || 0
      revenue += parseFloat(r.revenue_eur) || 0
      reservations += r.reservations || 0
    }
    return { nights, revenue, reservations, snapshotsUsed: Object.keys(byStay).length }
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const priorDate = new Date()
    priorDate.setDate(priorDate.getDate() - days)
    const priorStr = priorDate.toISOString().slice(0, 10)

    const current = await snapshotAt(today)
    const prior = await snapshotAt(priorStr)

    return NextResponse.json({
      current,
      prior,
      delta: {
        nights: current.nights - prior.nights,
        revenue: current.revenue - prior.revenue,
        reservations: current.reservations - prior.reservations,
      },
      days,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'query failed' }, { status: 500 })
  }
}
