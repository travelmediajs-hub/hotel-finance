import { NextResponse } from 'next/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchCreatoReservations, mapReservationToRow } from '@/lib/creato'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/creato/sync
// Body: { mode?: 'daily'|'full'|'history', from?, to?, propertyId? }
//
// Режими:
//   daily   – default. Тегли само активния прозорец: today-7d → today+180d.
//             Безопасно за всички роли. Прескача locked_at != NULL редове.
//   history – ръчен ресинк на стар период. Подава се from/to. Само ADMIN_CO.
//             Може да обновява и заключени редове (премахва locked_at).
//   full    – пълен ресинк (today-30d → today+365d). Само ADMIN_CO.
//
// Cron автентикация: Authorization: Bearer ${CRON_SECRET} → mode принуден на 'daily'.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const propertyId: string | null = body.propertyId ?? null

  // ── 1. Authentication / role gating ──
  const authHeader = req.headers.get('authorization') || ''
  const isCron =
    !!process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`

  let mode: 'daily' | 'full' | 'history' = (body.mode as any) || 'daily'
  let userId: string | null = null

  if (!isCron) {
    const user = await getFinanceUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    userId = user.id
    if ((mode === 'full' || mode === 'history') && user.role !== 'ADMIN_CO') {
      return NextResponse.json(
        { error: 'forbidden: само администратор може да пусне full/history sync' },
        { status: 403 },
      )
    }
  }

  // ── 2. Determine date range based on mode ──
  const todayD = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  let from: string
  let to: string

  if (mode === 'daily') {
    const f = new Date(todayD); f.setDate(f.getDate() - 7)
    const t = new Date(todayD); t.setDate(t.getDate() + 180)
    from = iso(f); to = iso(t)
  } else if (mode === 'full') {
    const f = new Date(todayD); f.setDate(f.getDate() - 30)
    const t = new Date(todayD); t.setDate(t.getDate() + 365)
    from = iso(f); to = iso(t)
  } else {
    // history
    from = body.from
    to = body.to
    if (!from || !to) {
      return NextResponse.json({ error: 'history mode изисква from/to' }, { status: 400 })
    }
  }

  const token = process.env.CREATO_TOKEN
  const hotelId = process.env.CREATO_HOTEL_ID
  if (!token || !hotelId) {
    return NextResponse.json(
      { error: 'CREATO_TOKEN / CREATO_HOTEL_ID не са конфигурирани' },
      { status: 500 },
    )
  }

  const admin = createAdminClient()
  const startedAt = new Date()
  let totalUpserted = 0
  let totalFetched = 0
  let totalSkippedLocked = 0
  let sampleKeys: string[] = []
  const errors: string[] = []

  // Разбиваме периода на месечни интервали
  const chunks: Array<{ from: string; to: string }> = []
  const cursor = new Date(from)
  const end = new Date(to)
  while (cursor <= end) {
    const chunkFrom = new Date(cursor)
    const chunkTo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    if (chunkTo > end) chunkTo.setTime(end.getTime())
    chunks.push({ from: iso(chunkFrom), to: iso(chunkTo) })
    cursor.setMonth(cursor.getMonth() + 1, 1)
  }

  for (const c of chunks) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 90_000)
      const data = await fetchCreatoReservations({
        from: c.from,
        to: c.to,
        token,
        hotelId,
        signal: controller.signal,
      })
      clearTimeout(t)
      totalFetched += data.length
      if (data.length > 0 && sampleKeys.length === 0) {
        sampleKeys = Object.keys(data[0] as any)
      }

      const mapped = data
        .map((r) => mapReservationToRow(r, { propertyId, pmsHotelId: hotelId }))
        .filter((r) => r.pms_res_id)
      const seen = new Map<string, ReturnType<typeof mapReservationToRow>>()
      for (const r of mapped) seen.set(r.pms_res_id, r)
      let rows = Array.from(seen.values())

      // ── Защита на заключени редове ──
      // daily / full → НЕ пипа locked редове.
      // history → отключва ги (admin override).
      if (rows.length > 0) {
        if (mode === 'history') {
          // Премахни заключването за тези pms_res_id-та
          const ids = rows.map((r) => r.pms_res_id)
          await admin
            .from('pms_reservations')
            .update({ locked_at: null })
            .in('pms_res_id', ids)
        } else {
          // Намери кои от тях вече са заключени и ги махни от batch-а
          const ids = rows.map((r) => r.pms_res_id)
          const { data: lockedRows } = await admin
            .from('pms_reservations')
            .select('pms_res_id')
            .in('pms_res_id', ids)
            .not('locked_at', 'is', null)
          const lockedSet = new Set((lockedRows ?? []).map((x: any) => x.pms_res_id))
          if (lockedSet.size > 0) {
            const before = rows.length
            rows = rows.filter((r) => !lockedSet.has(r.pms_res_id))
            totalSkippedLocked += before - rows.length
          }
        }
      }

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500)
          const { error } = await admin
            .from('pms_reservations')
            .upsert(batch, { onConflict: 'pms_hotel_id,pms_res_id' })
          if (error) throw error
          totalUpserted += batch.length
        }
      }
    } catch (e: any) {
      errors.push(`${c.from}–${c.to}: ${e?.message || 'error'}`)
    }
  }

  // ── Заключи стари резервации (>7 дни в миналото) ──
  // Изпълнява се само в daily / full режими.
  let lockedNow = 0
  if (mode !== 'history') {
    try {
      const { data: lockRes } = await admin.rpc('lock_old_pms_reservations', { days_old: 7 })
      if (typeof lockRes === 'number') lockedNow = lockRes
    } catch (e: any) {
      errors.push(`lock_old: ${e?.message || 'error'}`)
    }
  }

  // ── Pickup snapshot ──
  try {
    const today = new Date().toISOString().slice(0, 10)
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 180)
    const horizonStr = horizon.toISOString().slice(0, 10)

    let q = admin
      .from('pms_reservations')
      .select('from_date,to_date,days,total_eur,status,property_id')
      .lte('from_date', horizonStr)
      .gte('to_date', today)
      .in('status', ['OK', 'OUT', 'IN'])
    if (propertyId) q = q.eq('property_id', propertyId)
    const { data: resv } = await q

    const agg: Record<string, { nights: number; revenue: number; reservations: number }> = {}
    for (const r of resv ?? []) {
      const td = parseInt(String(r.days || 0))
      if (!td || !r.from_date || !r.to_date) continue
      const rpn = (parseFloat(String(r.total_eur || 0)) || 0) / td
      const start = new Date(r.from_date as string)
      const endD = new Date(r.to_date as string)
      const cur = new Date(start)
      let counted = false
      while (cur < endD) {
        const key = cur.toISOString().slice(0, 10)
        if (key >= today && key <= horizonStr) {
          if (!agg[key]) agg[key] = { nights: 0, revenue: 0, reservations: 0 }
          agg[key].nights++
          agg[key].revenue += rpn
          if (!counted) {
            agg[key].reservations++
            counted = true
          }
        }
        cur.setDate(cur.getDate() + 1)
      }
    }
    const snapRows = Object.entries(agg).map(([stay_date, v]) => ({
      property_id: propertyId,
      snapshot_date: today,
      stay_date,
      nights: v.nights,
      revenue_eur: Math.round(v.revenue * 100) / 100,
      reservations: v.reservations,
    }))
    if (snapRows.length > 0) {
      for (let i = 0; i < snapRows.length; i += 500) {
        await admin
          .from('pms_pickup_snapshots')
          .upsert(snapRows.slice(i, i + 500), {
            onConflict: 'property_id,snapshot_date,stay_date',
          })
      }
    }
  } catch (e: any) {
    errors.push(`snapshot: ${e?.message || 'error'}`)
  }

  await admin.from('pms_sync_log').insert({
    property_id: propertyId,
    pms_hotel_id: hotelId,
    range_from: from,
    range_to: to,
    rows_upserted: totalUpserted,
    ok: errors.length === 0,
    error: errors.length ? errors.join(' | ') : null,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: errors.length === 0,
    mode,
    triggered_by: isCron ? 'cron' : userId,
    range: { from, to },
    rows_fetched: totalFetched,
    rows_upserted: totalUpserted,
    rows_skipped_locked: totalSkippedLocked,
    rows_locked_now: lockedNow,
    chunks: chunks.length,
    sample_keys: sampleKeys,
    errors,
  })
}

// GET → cron-friendly. Vercel Cron праща GET със същия Authorization header.
export async function GET(req: Request) {
  return POST(
    new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ mode: 'daily' }),
    }),
  )
}
