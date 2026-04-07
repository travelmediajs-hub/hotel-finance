import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export const dynamic = 'force-dynamic'

// GET /api/creato/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD&propertyId=...&yoy=1
//
// Чете кеширани резервации от pms_reservations (бързо).
// Връща и резервации от същия период предишна година ако yoy=1.
export async function GET(req: Request) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const propertyId = searchParams.get('propertyId')
  const yoy = searchParams.get('yoy') === '1'
  if (!from || !to) {
    return NextResponse.json({ error: 'missing from/to' }, { status: 400 })
  }

  const supabase = await createClient()

  // Reservation overlaps the requested window when from_date < window_end+1 AND to_date >= window_start.
  // Експандираме 30 дни назад за да хванем резервации започнали по-рано.
  const expand = new Date(from)
  expand.setDate(expand.getDate() - 30)
  const extFrom = expand.toISOString().slice(0, 10)

  async function query(rangeFrom: string, rangeTo: string) {
    // Supabase/PostgREST връща max 1000 реда наведнъж — пагинираме до пълния резултат.
    const PAGE = 1000
    const all: any[] = []
    for (let offset = 0; ; offset += PAGE) {
      let q = supabase
        .from('pms_reservations')
        .select(
          'pms_res_id,status,from_date,to_date,book_date,days,id_room,id_ext_board,source,channel,company,total,total_eur,penalties,penalties_eur,currency,raw',
        )
        .lte('from_date', rangeTo)
        .gte('to_date', rangeFrom)
        .order('from_date', { ascending: true })
        .order('pms_res_id', { ascending: true })
        .range(offset, offset + PAGE - 1)
      if (propertyId) q = q.eq('property_id', propertyId)
      const { data, error } = await q
      if (error) throw error
      const rows = data ?? []
      all.push(...rows)
      if (rows.length < PAGE) break
      if (offset > 100000) break // safety
    }
    return all
  }

  try {
    const current = await query(extFrom, to)

    let prior: any[] | null = null
    if (yoy) {
      const py = (s: string) => {
        const d = new Date(s)
        d.setFullYear(d.getFullYear() - 1)
        return d.toISOString().slice(0, 10)
      }
      prior = await query(py(extFrom), py(to))
    }

    // Last sync info (for "Последна синхронизация" badge)
    let lastSync: { finished_at: string | null; rows_upserted: number; ok: boolean } | null = null
    {
      let q = supabase
        .from('pms_sync_log')
        .select('finished_at,rows_upserted,ok')
        .order('started_at', { ascending: false })
        .limit(1)
      if (propertyId) q = q.eq('property_id', propertyId)
      const { data } = await q
      lastSync = data?.[0] ?? null
    }

    // DEBUG: групирай по Status за бърза проверка какви статуси има в периода
    const statusBreakdown: Record<string, { count: number; total: number; penalties: number }> = {}
    for (const r of current) {
      const s = (r as any).status || '∅'
      if (!statusBreakdown[s]) statusBreakdown[s] = { count: 0, total: 0, penalties: 0 }
      statusBreakdown[s].count++
      statusBreakdown[s].total += parseFloat(String((r as any).total ?? 0)) || 0
      statusBreakdown[s].penalties += parseFloat(String((r as any).penalties ?? 0)) || 0
    }
    return NextResponse.json({ data: current, prior, lastSync, statusBreakdown })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'query failed' }, { status: 500 })
  }
}
