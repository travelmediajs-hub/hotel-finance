'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Dashboard — чете кеширани резервации от Supabase (pms_reservations).
// Поддържа Year-over-Year сравнение спрямо същия период предишна година.
// Бутон "Синхронизирай" дърпа нови данни от Creato Solutions PMS.
// ─────────────────────────────────────────────────────────────────────────────

const MO = ['Яну', 'Фев', 'Мар', 'Апр', 'Май', 'Юни', 'Юли', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек']

interface Reservation {
  Status?: string
  FromDate?: string
  ToDate?: string
  BookDate?: string
  Days?: string | number
  IdRoom?: string
  IdExtBoard?: string
  Source?: string
  Channel?: string
  Company?: string
  Total?: string | number
  Penalties?: string | number
  IdCurr?: string
  Extras?: number // BillsTotal от totals.total — допълнителни услуги
}

const fmt = (n: number, d = 0) =>
  new Intl.NumberFormat('bg-BG', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0)
const fmtEur = (n: number) => `${fmt(n, 0)} EUR`
const daysB = (d1?: string, d2?: string) =>
  d1 && d2 ? Math.max(0, Math.round((+new Date(d2) - +new Date(d1)) / 86400000)) : 0
const isoToDmy = (iso: string) => {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}
const dmyToIso = (dmy: string) => {
  if (!dmy) return ''
  const m = dmy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

const pyShift = (s: string) => {
  if (!s) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

interface Props {
  defaultRooms?: number
  userRole?: string
  defaultFrom?: string
  defaultTo?: string
  propertyId?: string
}

// DB row → in-memory shape used by compute(). Note: total/penalties are
// already in EUR (total_eur / penalties_eur), so currency is set to EUR.
function normaliseRow(row: any): Reservation {
  // Винаги работим с raw Total + currency, и конвертираме в EUR при нужда.
  const EUR_RATE = 1.95583
  const rawTotal = parseFloat(String(row.total ?? 0)) || 0
  const rawPen = parseFloat(String(row.penalties ?? 0)) || 0
  const isBgn = row.currency === 'BGN'
  const totalEur = isBgn ? rawTotal / EUR_RATE : rawTotal
  const penEur = isBgn ? rawPen / EUR_RATE : rawPen
  // Extras (BillsTotal) — допълнителни услуги, не са в Total
  const billsTotalRaw = parseFloat(String(row.raw?.totals?.total?.BillsTotal ?? 0)) || 0
  const extras = isBgn ? billsTotalRaw / EUR_RATE : billsTotalRaw
  return {
    Status: row.status ?? undefined,
    FromDate: row.from_date ?? undefined,
    ToDate: row.to_date ?? undefined,
    BookDate: row.book_date ?? undefined,
    Days: row.days ?? undefined,
    IdRoom: row.id_room ?? undefined,
    IdExtBoard: row.id_ext_board ?? undefined,
    Source: row.source ?? undefined,
    Channel: row.channel ?? undefined,
    Company: row.company ?? undefined,
    Total: totalEur,
    Penalties: penEur,
    Extras: extras,
    IdCurr: 'EUR',
  }
}

export function RevenueDashboard({ defaultRooms = 20, defaultFrom, defaultTo, propertyId, userRole }: Props) {
  const isAdmin = userRole === 'ADMIN_CO'
  const today = new Date()
  const initFrom = defaultFrom || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const initTo = defaultTo || today.toISOString().slice(0, 10)

  const [from, setFrom] = useState(initFrom)
  const [to, setTo] = useState(initTo)
  const [fromText, setFromText] = useState(isoToDmy(initFrom))
  const [toText, setToText] = useState(isoToDmy(initTo))
  const roomsKey = `revenue_dashboard_rooms_${propertyId || 'default'}`
  const [rooms, setRooms] = useState(defaultRooms)
  const [editingRooms, setEditingRooms] = useState(false)
  const [roomsDraft, setRoomsDraft] = useState(String(defaultRooms))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(roomsKey)
    if (saved) {
      const n = Number(saved)
      if (n > 0) {
        setRooms(n)
        setRoomsDraft(String(n))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsKey])
  const saveRooms = () => {
    const n = Number(roomsDraft) || 0
    if (n > 0) {
      setRooms(n)
      if (typeof window !== 'undefined') window.localStorage.setItem(roomsKey, String(n))
    }
    setEditingRooms(false)
  }
  const [data, setData] = useState<Reservation[] | null>(null)
  const [priorData, setPriorData] = useState<Reservation[] | null>(null)
  const [heatmapData, setHeatmapData] = useState<Reservation[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [compareYoy, setCompareYoy] = useState(true)
  const [pickup, setPickup] = useState<{
    current: { nights: number; revenue: number; reservations: number }
    prior: { nights: number; revenue: number; reservations: number }
    delta: { nights: number; revenue: number; reservations: number }
    days: number
  } | null>(null)
  const [pickupDays, setPickupDays] = useState(7)
  const [forecast, setForecast] = useState<{
    horizons: Array<{
      days: number
      otb: { nights: number; revenue: number; occupancy: number; adr: number; revpar: number; days: number }
      stly: { nights: number; revenue: number; occupancy: number; adr: number; revpar: number; days: number }
    }>
    rooms: number
  } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to, yoy: '1' })
      if (propertyId) params.set('propertyId', propertyId)
      const r = await fetch(`/api/creato/reservations?${params.toString()}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Грешка от API')
      setData((j.data || []).map(normaliseRow))
      setPriorData(j.prior ? j.prior.map(normaliseRow) : null)
      setLastSync(j.lastSync?.finished_at || null)
      // Pickup
      const p = new URLSearchParams({ from, to, days: String(pickupDays) })
      if (propertyId) p.set('propertyId', propertyId)
      const pr = await fetch(`/api/creato/pickup?${p.toString()}`)
      const pj = await pr.json()
      if (pr.ok) setPickup(pj)
      else setPickup(null)
      // Heatmap данни (фиксиран прозорец: текущ месец + следващ)
      try {
        const td = new Date()
        const hFrom = new Date(td.getFullYear(), td.getMonth(), 1)
        const hTo = new Date(td.getFullYear(), td.getMonth() + 2, 0)
        const isoD = (d: Date) => d.toISOString().slice(0, 10)
        const hp = new URLSearchParams({ from: isoD(hFrom), to: isoD(hTo) })
        if (propertyId) hp.set('propertyId', propertyId)
        const hr = await fetch(`/api/creato/reservations?${hp.toString()}`)
        const hj = await hr.json()
        if (hr.ok) setHeatmapData((hj.data || []).map(normaliseRow))
        else setHeatmapData(null)
      } catch { setHeatmapData(null) }
      // Forecast
      const fp = new URLSearchParams({ rooms: String(rooms) })
      if (propertyId) fp.set('propertyId', propertyId)
      const fr = await fetch(`/api/creato/forecast?${fp.toString()}`)
      const fj = await fr.json()
      if (fr.ok) setForecast(fj)
      else setForecast(null)
    } catch (e: any) {
      setError(e?.message || 'Грешка')
      setData([])
      setPriorData(null)
    } finally {
      setLoading(false)
    }
  }

  async function sync() {
    setSyncing(true)
    setError(null)
    try {
      // Daily mode: само активен прозорец (today-7d → today+180d).
      // Стари заключени резервации НЕ се пипат.
      const r = await fetch('/api/creato/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'daily', propertyId }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) {
        throw new Error(j.error || (j.errors && j.errors.join(' | ')) || 'Sync грешка')
      }
      await load()
    } catch (e: any) {
      setError(e?.message || 'Sync грешка')
    } finally {
      setSyncing(false)
    }
  }

  async function historySync() {
    if (!isAdmin) return
    if (!confirm(
      `Ще ресинкнеш стари (заключени) резервации за периода ${isoToDmy(from)} – ${isoToDmy(to)}.\n\n` +
      `Това ще презапише данни от Creato и може да отнеме време. Продължи?`
    )) return
    setSyncing(true)
    setError(null)
    try {
      const ranges = [
        { from, to },
        { from: pyShift(from), to: pyShift(to) },
      ]
      for (const range of ranges) {
        const r = await fetch('/api/creato/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'history', ...range, propertyId }),
        })
        const j = await r.json()
        if (!r.ok || !j.ok) {
          throw new Error(j.error || (j.errors && j.errors.join(' | ')) || 'History sync грешка')
        }
      }
      await load()
    } catch (e: any) {
      setError(e?.message || 'History sync грешка')
    } finally {
      setSyncing(false)
    }
  }

  // Не зареждаме автоматично — потребителят натиска "Покажи" след избор на период.

  const calc = useMemo(() => (data ? compute(data, from, to, rooms) : null), [data, from, to, rooms])
  const heatmapCells = useMemo(() => {
    const src = heatmapData ?? data
    if (!src) return null
    const td = new Date()
    const hFrom = new Date(td.getFullYear(), td.getMonth(), 1).toISOString().slice(0, 10)
    const hTo = new Date(td.getFullYear(), td.getMonth() + 2, 0).toISOString().slice(0, 10)
    return compute(src, hFrom, hTo, rooms).heatmap
  }, [heatmapData, data, rooms])
  const prior = useMemo(
    () => (priorData && compareYoy ? compute(priorData, pyShift(from), pyShift(to), rooms) : null),
    [priorData, from, to, rooms, compareYoy],
  )

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="flex items-end gap-3 flex-wrap py-4">
          <div className="text-xs text-muted-foreground self-center">
            <div className="opacity-70">Период</div>
            <div className="font-medium text-foreground">{isoToDmy(from)} – {isoToDmy(to)}</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Стаи</label>
            {editingRooms ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={roomsDraft}
                  onChange={(e) => setRoomsDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveRooms() }}
                  autoFocus
                  className="border rounded px-2 py-1.5 text-sm bg-background w-20"
                />
                <button
                  type="button"
                  onClick={saveRooms}
                  className="px-2 py-1.5 rounded bg-primary text-primary-foreground text-xs"
                >
                  Запази
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="border rounded px-2 py-1.5 text-sm bg-muted/40 w-20 text-center font-medium">
                  {rooms}
                </div>
                <button
                  type="button"
                  onClick={() => { setRoomsDraft(String(rooms)); setEditingRooms(true) }}
                  className="px-2 py-1.5 rounded bg-secondary text-secondary-foreground text-xs"
                >
                  Промени
                </button>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground select-none mb-1.5">
            <input
              type="checkbox"
              checked={compareYoy}
              onChange={(e) => setCompareYoy(e.target.checked)}
              className="rounded"
            />
            Сравни с предишна година
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading || syncing}
            className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-sm disabled:opacity-50"
          >
            {loading ? 'Зареждам…' : 'Покажи'}
          </button>
          <button
            type="button"
            onClick={sync}
            disabled={syncing || loading}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50"
            title="Дърпа нови резервации от Creato в локалната база (текущ период + същия период миналата година)"
          >
            {syncing ? 'Синхронизирам…' : '↻ Синхронизирай от PMS'}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={historySync}
              disabled={syncing || loading}
              className="px-3 py-1.5 rounded border border-amber-500/50 text-amber-600 dark:text-amber-400 text-sm disabled:opacity-50"
              title="Само администратор: ресинква стари (заключени) резервации за избрания период"
            >
              ⚠ Ресинк история
            </button>
          )}
          <div className="text-xs text-muted-foreground ml-auto space-y-0.5 text-right">
            {data && !loading && (
              <div>✓ {data.length} резервации в периода</div>
            )}
            {lastSync && (
              <div>Последна синхронизация: {new Date(lastSync).toLocaleString('bg-BG')}</div>
            )}
            {(() => {
              const t = new Date()
              const lockEnd = new Date(t); lockEnd.setDate(lockEnd.getDate() - 8)
              const activeStart = new Date(t); activeStart.setDate(activeStart.getDate() - 7)
              const activeEnd = new Date(t); activeEnd.setDate(activeEnd.getDate() + 180)
              const f = (d: Date) => d.toLocaleDateString('bg-BG')
              return (
                <div className="flex items-center gap-2 justify-end pt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    🔒 Заключени до {f(lockEnd)}
                  </span>
                  <span className="opacity-50">|</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Активни {f(activeStart)} – {f(activeEnd)}
                  </span>
                </div>
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-500/50">
          <CardContent className="py-3 text-sm text-rose-500">⚠ {error}</CardContent>
        </Card>
      )}

      {!calc ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Зареждам данни…</CardContent></Card>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">📊 Обзор</TabsTrigger>
            <TabsTrigger value="revenue">💰 Приходи</TabsTrigger>
            <TabsTrigger value="channels">📡 Канали</TabsTrigger>
            <TabsTrigger value="cancellations">❌ Анулации</TabsTrigger>
            <TabsTrigger value="leadtime">🕐 Lead Time</TabsTrigger>
            <TabsTrigger value="forecast">🔮 Forecast</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi label="Total Revenue" value={fmtEur(calc.rev)} prior={prior?.rev} format={fmtEur} sub={`${calc.ok.length} потвърдени`} accent="amber" />
              <Kpi label="ADR" value={`${fmt(calc.adr, 2)} EUR`} prior={prior?.adr} format={(v) => `${fmt(v, 2)} EUR`} sub={`${fmt(calc.nts)} нощувки`} accent="blue" />
              <Kpi label="Occupancy" value={`${fmt(calc.occ, 1)} %`} prior={prior?.occ} format={(v) => `${fmt(v, 1)} %`} sub={`${rooms} стаи`} accent="emerald" />
              <Kpi label="RevPAR" value={`${fmt(calc.rvp, 2)} EUR`} prior={prior?.rvp} format={(v) => `${fmt(v, 2)} EUR`} sub="per available room" accent="violet" />
              <Kpi label="Анулации" value={`${fmt(calc.cRate, 1)} %`} prior={prior?.cRate} format={(v) => `${fmt(v, 1)} %`} sub={`${calc.st.length} от ${calc.all.length}`} accent="rose" inverse />
              <Kpi label="Lead Time" value={`${fmt(calc.avgLead, 0)} дни`} prior={prior?.avgLead} format={(v) => `${fmt(v, 0)} дни`} sub="среден" accent="cyan" />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Месечен приход (EUR){prior ? ' — текуща vs предишна година' : ''}</CardTitle></CardHeader>
              <CardContent><MonthBars values={calc.mR} priorValues={prior?.mR} format={fmtEur} color="bg-amber-500" /></CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Нощувки по месец</CardTitle></CardHeader>
                <CardContent><MonthBars values={calc.mN} priorValues={prior?.mN} format={(v) => fmt(v)} color="bg-blue-500" /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Потвърдени vs Анулирани</CardTitle></CardHeader>
                <CardContent><StackedMonthBars confirmed={calc.mOk} cancelled={calc.mC} /></CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base">Натоварване по ден от седмицата</CardTitle></CardHeader>
                <CardContent><DowBars occ={calc.dowOcc} nts={calc.dowNts} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Booking Window</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const tot = Object.values(calc.bkt).reduce((s, v) => s + v, 0) || 1
                    return (
                      <HBars
                        items={Object.entries(calc.bkt).map(
                          ([k, v]) => [`${k} дни`, (v / tot) * 100] as [string, number],
                        )}
                        format={(v) => `${fmt(v, 1)} %`}
                      />
                    )
                  })()}
                </CardContent>
              </Card>
            </div>
            {pickup && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Pickup за последните
                    <select
                      value={pickupDays}
                      onChange={(e) => {
                        setPickupDays(parseInt(e.target.value))
                        setTimeout(load, 0)
                      }}
                      className="bg-muted text-sm rounded px-2 py-0.5"
                    >
                      <option value={1}>1 ден</option>
                      <option value={3}>3 дни</option>
                      <option value={7}>7 дни</option>
                      <option value={14}>14 дни</option>
                      <option value={30}>30 дни</option>
                    </select>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Нощувки</div>
                      <div className="text-2xl font-semibold">
                        {pickup.delta.nights >= 0 ? '+' : ''}
                        {fmt(pickup.delta.nights)}
                      </div>
                      <div className="text-xs text-muted-foreground">{fmt(pickup.current.nights)} on-the-books</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Приход (EUR)</div>
                      <div className="text-2xl font-semibold">
                        {pickup.delta.revenue >= 0 ? '+' : ''}
                        {fmt(pickup.delta.revenue, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">{fmt(pickup.current.revenue, 0)} on-the-books</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Резервации</div>
                      <div className="text-2xl font-semibold">
                        {pickup.delta.reservations >= 0 ? '+' : ''}
                        {fmt(pickup.delta.reservations)}
                      </div>
                      <div className="text-xs text-muted-foreground">{fmt(pickup.current.reservations)} on-the-books</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle className="text-base">Календар на натоварването</CardTitle></CardHeader>
              <CardContent><HeatmapCalendar cells={heatmapCells ?? calc.heatmap} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Cancellation Rate по месец</CardTitle></CardHeader>
              <CardContent>
                <MonthBars
                  values={calc.mOk.map((o, i) => {
                    const tot = o + calc.mC[i]
                    return tot > 0 ? (calc.mC[i] / tot) * 100 : 0
                  })}
                  format={(v) => `${fmt(v, 1)} %`}
                  color="bg-rose-500"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Kpi label="Total Revenue" value={fmtEur(calc.rev)} prior={prior?.rev} format={fmtEur} sub={`${fmt(calc.nts)} нощувки`} accent="amber" />
              <Kpi label="ADR" value={`${fmt(calc.adr, 2)} EUR`} prior={prior?.adr} format={(v) => `${fmt(v, 2)} EUR`} sub="Средна цена / нощувка" accent="blue" />
              <Kpi label="RevPAR" value={`${fmt(calc.rvp, 2)} EUR`} prior={prior?.rvp} format={(v) => `${fmt(v, 2)} EUR`} sub="Rev per available room" accent="violet" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Приход по тип стая</CardTitle></CardHeader>
                <CardContent><HBars items={calc.byRoom} format={fmtEur} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Приход по тип хранене</CardTitle></CardHeader>
                <CardContent><HBars items={calc.byBoard} format={fmtEur} /></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="channels" className="space-y-4">
            {(() => {
              const totRev = calc.byChannel.reduce((s, [, v]) => s + v.r, 0) || 1
              const totCnt = calc.byChannel.reduce((s, [, v]) => s + v.c, 0) || 1
              return (
                <>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Приход по канал</CardTitle></CardHeader>
                    <CardContent>
                      <HBars
                        items={calc.byChannel.map(([k, v]) => [k, v.r] as [string, number])}
                        format={(val) => `${fmtEur(val)} (${fmt((val / totRev) * 100, 1)}%)`}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">% дял на приходите (микс)</CardTitle></CardHeader>
                    <CardContent>
                      <HBars
                        items={calc.byChannel.map(
                          ([k, v]) => [k, (v.r / totRev) * 100] as [string, number],
                        )}
                        format={(v) => `${fmt(v, 1)} %`}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Брой резервации по канал</CardTitle></CardHeader>
                    <CardContent>
                      <HBars
                        items={calc.byChannel.map(([k, v]) => [k, v.c] as [string, number])}
                        format={(val) => `${fmt(val)} (${fmt((val / totCnt) * 100, 1)}%)`}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">ADR по канал (EUR)</CardTitle></CardHeader>
                    <CardContent>
                      <HBars
                        items={calc.byChannel.map(
                          ([k, v]) => [k, v.c > 0 ? v.r / v.c : 0] as [string, number],
                        )}
                        format={(v) => `${fmt(v, 2)} €`}
                      />
                    </CardContent>
                  </Card>
                </>
              )
            })()}
          </TabsContent>

          <TabsContent value="cancellations" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Kpi label="Анулирани" value={String(calc.st.length)} prior={prior?.st.length} format={(v) => String(Math.round(v))} sub={`${fmt(calc.cRate, 1)}% от всички`} accent="rose" inverse />
              <Kpi label="Неустойки" value={fmtEur(calc.pen)} prior={prior?.pen} format={fmtEur} sub="Реализирани" accent="amber" />
              <Kpi label="Изгубен приход" value={fmtEur(calc.lost)} prior={prior?.lost} format={fmtEur} sub="Потенциален" accent="rose" inverse />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Анулации по месец</CardTitle></CardHeader>
              <CardContent><MonthBars values={calc.mC} priorValues={prior?.mC} format={(v) => fmt(v)} color="bg-rose-500" /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Неустойки по месец (EUR)</CardTitle></CardHeader>
              <CardContent><MonthBars values={calc.mP} priorValues={prior?.mP} format={fmtEur} color="bg-amber-500" /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leadtime" className="space-y-4">
            <Kpi label="Среден Lead Time" value={`${fmt(calc.avgLead, 0)} дни`} prior={prior?.avgLead} format={(v) => `${fmt(v, 0)} дни`} sub="дни предварително" accent="cyan" />
            <Card>
              <CardHeader><CardTitle className="text-base">Разпределение по Lead Time</CardTitle></CardHeader>
              <CardContent>
                <HBars
                  items={(() => {
                    const tot = Object.values(calc.bkt).reduce((s, v) => s + v, 0) || 1
                    return Object.entries(calc.bkt).map(
                      ([k, v]) => [`${k} дни`, (v / tot) * 100] as [string, number],
                    )
                  })()}
                  format={(v) => `${fmt(v, 1)} %`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-4">
            {!forecast && (
              <div className="text-sm text-muted-foreground">
                Натисни „Покажи" за да заредиш forecast (изисква синхронизирани бъдещи резервации).
              </div>
            )}
            {forecast && (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  On-the-books прогноза за следващите 30 / 60 / 90 дни. STLY = Same Time Last Year — къде беше хотелът на тази дата миналата година.
                </div>
                {(() => {
                  // Smart adjustments на база избрания период:
                  //   yoyGrowth = (calc.rev / prior.rev) - 1 — текущ растеж спрямо мин. година
                  //   cancelRate = calc.cRate / 100 — историческо ниво на анулациите
                  const yoyGrowth =
                    prior && prior.rev > 0 ? calc.rev / prior.rev - 1 : 0
                  const cancelRate = calc.cRate / 100
                  return (
                    <div className="text-xs text-muted-foreground border border-muted rounded p-2 mb-2 space-y-1">
                      <div>
                        Smart Forecast корекции (от избрания период):
                        {' '}YoY ръст{' '}
                        <span className={yoyGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                          {yoyGrowth >= 0 ? '+' : ''}{fmt(yoyGrowth * 100, 1)}%
                        </span>
                        {' · '}анулации <span className="text-rose-500">−{fmt(cancelRate * 100, 1)}%</span>
                      </div>
                      <div className="text-[10px] opacity-70 leading-tight">
                        YoY (Year-over-Year) = ръст спрямо същия период миналата година.
                        {' '}Изчисление: ({fmtEur(calc.rev)} текущ ÷ {fmtEur(prior?.rev || 0)} миналата г.) − 1 = {fmt(yoyGrowth * 100, 1)}%.
                        {' '}Анулации: {calc.st.length} анулирани от общо {calc.all.length} = {fmt(cancelRate * 100, 1)}%.
                        {' '}Формула: max(OTB, STLY × (1 + YoY)) × (1 − анулации).
                      </div>
                    </div>
                  )
                })()}
                {forecast.horizons.map((h) => {
                  const occDelta = h.otb.occupancy - h.stly.occupancy
                  const revDelta = h.stly.revenue > 0 ? ((h.otb.revenue - h.stly.revenue) / h.stly.revenue) * 100 : 0
                  const adrDelta = h.stly.adr > 0 ? ((h.otb.adr - h.stly.adr) / h.stly.adr) * 100 : 0
                  const yoyGrowth = prior && prior.rev > 0 ? calc.rev / prior.rev - 1 : 0
                  const cancelRate = calc.cRate / 100
                  // Smart Forecast = STLY × (1 + yoyGrowth)  — очакван финален обем
                  // Финализираме като max(otb, stlyAdjusted) × (1 - cancelRate)
                  const stlyAdj = h.stly.revenue * (1 + yoyGrowth)
                  const smartRev = Math.max(h.otb.revenue, stlyAdj) * (1 - cancelRate)
                  const smartOcc = Math.max(h.otb.occupancy, h.stly.occupancy * (1 + yoyGrowth)) * (1 - cancelRate)
                  const smartAdr = h.otb.adr > 0 ? h.otb.adr : h.stly.adr * (1 + yoyGrowth)
                  return (
                    <Card key={h.days}>
                      <CardHeader>
                        <CardTitle className="text-base">Следващите {h.days} дни</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground">Total Revenue</div>
                            <div className="text-2xl font-semibold">{fmtEur(h.otb.revenue)}</div>
                            <div className={`text-xs ${revDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {revDelta >= 0 ? '▲' : '▼'} {fmt(Math.abs(revDelta), 1)}% vs STLY ({fmtEur(h.stly.revenue)})
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Occupancy</div>
                            <div className="text-2xl font-semibold">{fmt(h.otb.occupancy, 1)} %</div>
                            <div className={`text-xs ${occDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {occDelta >= 0 ? '▲' : '▼'} {fmt(Math.abs(occDelta), 1)} pts vs STLY ({fmt(h.stly.occupancy, 1)}%)
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">ADR</div>
                            <div className="text-2xl font-semibold">{fmt(h.otb.adr, 2)} €</div>
                            <div className={`text-xs ${adrDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {adrDelta >= 0 ? '▲' : '▼'} {fmt(Math.abs(adrDelta), 1)}% vs STLY ({fmt(h.stly.adr, 2)} €)
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">RevPAR</div>
                            <div className="text-2xl font-semibold">{fmt(h.otb.revpar, 2)} €</div>
                            <div className="text-xs text-muted-foreground">
                              STLY: {fmt(h.stly.revpar, 2)} €
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          {fmt(h.otb.nights)} нощувки on-the-books · {fmt(h.stly.nights)} STLY
                        </div>
                        <div className="mt-3 pt-3 border-t border-muted">
                          <div className="text-xs text-muted-foreground mb-2">🎯 Smart Forecast (с YoY ръст и анулации):</div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <div className="text-[10px] text-muted-foreground">Очакван приход</div>
                              <div className="text-lg font-semibold text-emerald-500">{fmtEur(smartRev)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground">Очаквана заетост</div>
                              <div className="text-lg font-semibold text-emerald-500">{fmt(smartOcc, 1)} %</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground">Очакван ADR</div>
                              <div className="text-lg font-semibold text-emerald-500">{fmt(smartAdr, 2)} €</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// ─── Pure compute function (used for current period AND prior year) ─────────

function compute(data: Reservation[], from: string, to: string, rooms: number) {
  // `to` се третира като INCLUSIVE — нощта на `to` СЕ брои.
  // pTo се вдига с +1 ден, и наличността по-долу също (days+1).
  const pFrom = new Date(from)
  const pTo = new Date(to)
  pTo.setDate(pTo.getDate() + 1)
  const nightsInPeriod = (a?: string, b?: string) => {
    if (!a || !b) return 0
    const s = new Date(Math.max(+new Date(a), +pFrom))
    const e = new Date(Math.min(+new Date(b), +pTo))
    return Math.max(0, Math.round((+e - +s) / 86400000))
  }

  const ok = data.filter((r) => r.Status === 'OK' || r.Status === 'OUT' || r.Status === 'IN')
  const ns = data.filter((r) => r.Status === 'NS') // no-show
  const st = data.filter((r) => r.Status === 'ST') // cancelled
  const all = [...ok, ...st, ...ns]

  const arrivalIn = (r: Reservation) => {
    if (!r.FromDate) return false
    const a = new Date(r.FromDate)
    return +a >= +pFrom && +a < +pTo
  }

  let rev = 0
  let nts = 0
  for (const r of ok) {
    const td = parseInt(String(r.Days || 0))
    const total = parseFloat(String(r.Total || 0))
    if (!td) {
      if (arrivalIn(r)) rev += total
      continue
    }
    const inP = nightsInPeriod(r.FromDate, r.ToDate)
    rev += total * (inP / td)
    nts += inP
  }
  // No-show: само неустойката (Penalties), в датата на пристигане
  for (const r of ns) {
    if (arrivalIn(r)) rev += parseFloat(String(r.Penalties || 0))
  }
  const adr = nts > 0 ? rev / nts : 0
  // +1 защото `to` е inclusive (същия ден също се брои като една нощ)
  const days = (daysB(from, to) + 1) || 1
  const avl = rooms * days
  const occ = avl > 0 ? (nts / avl) * 100 : 0
  const rvp = avl > 0 ? rev / avl : 0
  // Cancellation rate: само резервации с пристигане в избрания период
  const okInP = ok.filter(arrivalIn)
  const stInP = st.filter(arrivalIn)
  const nsInP = ns.filter(arrivalIn)
  const denom = okInP.length + stInP.length + nsInP.length
  const cRate = denom > 0 ? (stInP.length / denom) * 100 : 0
  const pen = st.reduce((s, r) => s + parseFloat(String(r.Penalties || 0)), 0)
  const lost = st.reduce((s, r) => {
    const td = parseInt(String(r.Days || 0))
    if (!td) return s
    const inP = nightsInPeriod(r.FromDate, r.ToDate)
    return s + parseFloat(String(r.Total || 0)) * (inP / td)
  }, 0)
  const leads = ok.map((r) => daysB(r.BookDate, r.FromDate)).filter((d) => d > 0)
  const avgLead = leads.length > 0 ? leads.reduce((s, v) => s + v, 0) / leads.length : 0

  // Monthly aggregations (12 buckets, индексирани по месец на началната дата)
  const mR = Array(12).fill(0)
  const mN = Array(12).fill(0)
  const mOk = Array(12).fill(0)
  const mC = Array(12).fill(0)
  const mP = Array(12).fill(0)
  for (const r of data) {
    const isOk = r.Status === 'OK' || r.Status === 'OUT' || r.Status === 'IN'
    const isSt = r.Status === 'ST'
    if (!isOk && !isSt) continue
    const td = parseInt(String(r.Days || 0))
    const totalRev = parseFloat(String(r.Total || 0))
    const rpn = td > 0 ? totalRev / td : 0
    const arrM = parseInt((r.FromDate || '').split('-')[1] || '0') - 1
    if (isSt && arrM >= 0 && arrM <= 11) {
      mC[arrM]++
      mP[arrM] += parseFloat(String(r.Penalties || 0))
    }
    // (статус IN = currently checked-in, броим го като OK)
    if (isOk && r.FromDate && r.ToDate) {
      if (arrM >= 0 && arrM <= 11) mOk[arrM]++
      const d = new Date(r.FromDate)
      const end = new Date(r.ToDate)
      while (d < end) {
        const m = d.getMonth()
        if (m >= 0 && m <= 11) {
          mR[m] += rpn
          mN[m] += 1
        }
        d.setDate(d.getDate() + 1)
      }
    }
  }

  const rm: Record<string, number> = {}
  ok.forEach((r) => {
    const k = r.IdRoom || '—'
    rm[k] = (rm[k] || 0) + parseFloat(String(r.Total || 0))
  })
  const byRoom = Object.entries(rm).sort((a, b) => b[1] - a[1])

  const bd: Record<string, number> = {}
  ok.forEach((r) => {
    const k = r.IdExtBoard || '—'
    bd[k] = (bd[k] || 0) + parseFloat(String(r.Total || 0))
  })
  const byBoard = Object.entries(bd).sort((a, b) => b[1] - a[1])

  const ch: Record<string, { r: number; c: number }> = {}
  ok.forEach((r) => {
    const k = r.Source || r.Channel || r.Company || 'Директно'
    if (!ch[k]) ch[k] = { r: 0, c: 0 }
    ch[k].r += parseFloat(String(r.Total || 0))
    ch[k].c++
  })
  const byChannel = Object.entries(ch).sort((a, b) => b[1].r - a[1].r)

  const bkt: Record<string, number> = { '0–7': 0, '8–14': 0, '15–30': 0, '31–60': 0, '61+': 0 }
  ok.forEach((r) => {
    const d = daysB(r.BookDate, r.FromDate)
    if (d <= 7) bkt['0–7']++
    else if (d <= 14) bkt['8–14']++
    else if (d <= 30) bkt['15–30']++
    else if (d <= 60) bkt['31–60']++
    else bkt['61+']++
  })

  // ── Натоварване по ден от седмицата (само за дни ВЪТРЕ в избрания период) ──
  // dow: 0=Понеделник ... 6=Неделя
  const dowNts = Array(7).fill(0) // нощувки
  const dowAvl = Array(7).fill(0) // налични room-nights
  // Брой налични дни от седмицата в периода
  {
    const d = new Date(from)
    const end = new Date(to)
    while (d <= end) {
      const js = d.getDay() // 0=Sun..6=Sat
      const idx = (js + 6) % 7 // 0=Mon..6=Sun
      dowAvl[idx] += rooms
      d.setDate(d.getDate() + 1)
    }
  }
  // Брой нощувки по ден от седмицата (всяка нощ от стой, която е в периода)
  for (const r of ok) {
    if (!r.FromDate || !r.ToDate) continue
    const start = new Date(Math.max(+new Date(r.FromDate), +pFrom))
    const end = new Date(Math.min(+new Date(r.ToDate), +pTo))
    const cur = new Date(start)
    while (cur < end) {
      const js = cur.getDay()
      const idx = (js + 6) % 7
      dowNts[idx]++
      cur.setDate(cur.getDate() + 1)
    }
  }
  const dowOcc = dowNts.map((n, i) => (dowAvl[i] > 0 ? (n / dowAvl[i]) * 100 : 0))

  // ── Daily heatmap за фиксиран прозорец: текущ месец + следващ ──
  type DayCell = { date: string; nts: number; rev: number; occ: number; adr: number }
  const today = new Date()
  const hStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const hEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
  const hEndExcl = new Date(today.getFullYear(), today.getMonth() + 2, 1)
  const dayMap: Record<string, DayCell> = {}
  {
    const d = new Date(hStart)
    while (d <= hEnd) {
      const key = d.toISOString().slice(0, 10)
      dayMap[key] = { date: key, nts: 0, rev: 0, occ: 0, adr: 0 }
      d.setDate(d.getDate() + 1)
    }
  }
  for (const r of ok) {
    const td = parseInt(String(r.Days || 0))
    if (!td || !r.FromDate || !r.ToDate) continue
    const totalRev = parseFloat(String(r.Total || 0))
    const rpn = totalRev / td
    const start = new Date(Math.max(+new Date(r.FromDate), +hStart))
    const endN = new Date(Math.min(+new Date(r.ToDate), +hEndExcl))
    const cur = new Date(start)
    while (cur < endN) {
      const key = cur.toISOString().slice(0, 10)
      if (dayMap[key]) {
        dayMap[key].nts++
        dayMap[key].rev += rpn
      }
      cur.setDate(cur.getDate() + 1)
    }
  }
  const heatmap: DayCell[] = Object.values(dayMap).map((c) => ({
    ...c,
    occ: rooms > 0 ? (c.nts / rooms) * 100 : 0,
    adr: c.nts > 0 ? c.rev / c.nts : 0,
  }))

  return { ok, st, ns, all, rev, nts, adr, occ, rvp, cRate, pen, lost, avgLead, mR, mN, mOk, mC, mP, byRoom, byBoard, byChannel, bkt, dowOcc, dowNts, heatmap }
}

// ─── Helper presentation components ─────────────────────────────────────────

function Kpi({
  label,
  value,
  sub,
  accent,
  prior,
  format,
  inverse,
}: {
  label: string
  value: string
  sub?: string
  accent: 'amber' | 'blue' | 'emerald' | 'violet' | 'rose' | 'cyan'
  prior?: number
  format?: (v: number) => string
  inverse?: boolean // true: повишение е лошо (анулации, изгубен приход)
}) {
  const colorMap: Record<string, string> = {
    amber: 'border-t-amber-500',
    blue: 'border-t-blue-500',
    emerald: 'border-t-emerald-500',
    violet: 'border-t-violet-500',
    rose: 'border-t-rose-500',
    cyan: 'border-t-cyan-500',
  }
  // Parse the visible value to a number for delta calc
  const cur = parseFloat(value.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0
  let deltaPct: number | null = null
  if (prior != null) {
    if (prior === 0) deltaPct = cur > 0 ? 100 : 0
    else deltaPct = ((cur - prior) / prior) * 100
  }
  const goodUp = !inverse
  const goodColor =
    deltaPct == null
      ? 'text-muted-foreground'
      : (deltaPct >= 0) === goodUp
        ? 'text-emerald-500'
        : 'text-rose-500'

  return (
    <Card className={`border-t-2 ${colorMap[accent]}`}>
      <CardHeader className="pb-1">
        <CardTitle className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        {prior != null && (
          <div className={`text-[11px] mt-1 tabular-nums ${goodColor}`}>
            {deltaPct != null && (
              <span>
                {deltaPct >= 0 ? '▲' : '▼'} {fmt(Math.abs(deltaPct), 1)}%
              </span>
            )}{' '}
            <span className="text-muted-foreground">vs {format ? format(prior) : fmt(prior)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HeatmapCalendar({
  cells,
}: {
  cells: { date: string; nts: number; rev: number; occ: number; adr: number }[]
}) {
  const [metric, setMetric] = useState<'occ' | 'rev' | 'adr'>('occ')
  // Винаги показваме текущия месец + следващия (независимо от избрания период)
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
  const cellMap: Record<string, typeof cells[0]> = {}
  for (const c of cells) cellMap[c.date] = c
  const monthLabel = (d: Date) =>
    d.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
  const fmtVal = (v: number) =>
    metric === 'occ' ? `${fmt(v, 0)}%` : `${fmt(v, 0)}€`

  function buildMonth(monthDate: Date) {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
    const firstDow = (first.getDay() + 6) % 7
    const grid: (typeof cells[0] | null)[] = []
    for (let i = 0; i < firstDow; i++) grid.push(null)
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = new Date(monthDate.getFullYear(), monthDate.getMonth(), d)
        .toISOString()
        .slice(0, 10)
      grid.push(cellMap[iso] || { date: iso, nts: 0, rev: 0, occ: 0, adr: 0 })
    }
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }
  // Изчисли max от двата месеца за консистентен цвят
  const allInRange = Object.values(cellMap).filter((c) => {
    const d = new Date(c.date)
    return d >= monthStart && d <= nextMonthEnd
  })
  const max = Math.max(...allInRange.map((c) => c[metric]), 1)
  const months = [
    monthStart,
    new Date(today.getFullYear(), today.getMonth() + 1, 1),
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-1 text-xs">
        {(['occ', 'rev', 'adr'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-2 py-0.5 rounded ${metric === m ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}
          >
            {m === 'occ' ? 'Occupancy' : m === 'rev' ? 'Revenue' : 'ADR'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {months.map((m, idx) => {
          const grid = buildMonth(m)
          return (
            <div key={idx} className="space-y-1">
              <div className="text-xs font-medium text-center capitalize">{monthLabel(m)}</div>
              <div className="grid grid-cols-7 gap-0.5 text-[9px]">
                {labels.map((l) => (
                  <div key={l} className="text-center text-muted-foreground">{l}</div>
                ))}
                {grid.map((c, i) => {
                  if (!c) return <div key={i} />
                  const day = new Date(c.date).getDate()
                  const v = c[metric]
                  const intensity = Math.min(1, v / max)
                  const bg = v <= 0 ? 'rgba(120,120,120,0.12)' : `rgba(16,185,129,${0.15 + intensity * 0.85})`
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-sm flex flex-col items-center justify-center text-[8px] leading-none"
                      style={{ background: bg, color: intensity > 0.5 ? 'white' : undefined }}
                      title={`${c.date}\nOcc: ${fmt(c.occ, 0)}%\nRev: ${fmt(c.rev, 0)} €\nADR: ${fmt(c.adr, 0)} €`}
                    >
                      <div className="font-medium">{day}</div>
                      {v > 0 && <div className="opacity-80 text-[7px]">{fmtVal(v)}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DowBars({ occ, nts }: { occ: number[]; nts: number[] }) {
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
  const max = Math.max(...occ, 1)
  return (
    <div className="flex items-end gap-2 h-48">
      {occ.map((v, i) => {
        const h = (v / max) * 100
        const isWeekend = i >= 5
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
            <div className="text-[10px] text-muted-foreground tabular-nums">{fmt(v, 0)}%</div>
            <div className="w-full flex-1 bg-muted/30 rounded-t flex items-end overflow-hidden">
              <div
                className={`w-full ${isWeekend ? 'bg-violet-500' : 'bg-emerald-500'}`}
                style={{ height: `${h}%` }}
                title={`${nts[i]} нощувки`}
              />
            </div>
            <div className="text-xs text-muted-foreground">{labels[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

function MonthBars({
  values,
  priorValues,
  format,
  color,
}: {
  values: number[]
  priorValues?: number[]
  format: (v: number) => string
  color: string
}) {
  const max = Math.max(...values, ...(priorValues || []), 1)
  return (
    <div className="flex items-end gap-2 h-40">
      {values.map((v, i) => {
        const h = (v / max) * 100
        const ph = priorValues ? (priorValues[i] / max) * 100 : 0
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex-1 w-full flex items-end gap-0.5">
              {priorValues && (
                <div
                  className="bg-muted-foreground/40 flex-1 rounded-t"
                  style={{ height: `${ph}%` }}
                  title={`Минала год.: ${format(priorValues[i])}`}
                />
              )}
              <div className={`${color} flex-1 rounded-t`} style={{ height: `${h}%` }} title={format(v)} />
            </div>
            <div className="text-[10px] text-muted-foreground">{MO[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

function StackedMonthBars({ confirmed, cancelled }: { confirmed: number[]; cancelled: number[] }) {
  const max = Math.max(...confirmed.map((c, i) => c + cancelled[i]), 1)
  return (
    <div className="flex items-end gap-2 h-40">
      {confirmed.map((c, i) => {
        const tot = c + cancelled[i]
        const h = (tot / max) * 100
        const okPct = tot > 0 ? (c / tot) * 100 : 0
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex-1 w-full flex items-end">
              <div className="w-full rounded-t overflow-hidden flex flex-col" style={{ height: `${h}%` }}>
                <div className="bg-rose-500" style={{ height: `${100 - okPct}%` }} title={`Анулирани: ${cancelled[i]}`} />
                <div className="bg-emerald-500 flex-1" title={`Потвърдени: ${c}`} />
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">{MO[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

function HBars({ items, format }: { items: [string, number][]; format: (v: number) => string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Няма данни.</p>
  const max = Math.max(...items.map(([, v]) => v), 1)
  return (
    <div className="space-y-2">
      {items.map(([k, v]) => {
        const w = (v / max) * 100
        return (
          <div key={k}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="truncate max-w-[60%]" title={k}>{k}</span>
              <span className="text-muted-foreground tabular-nums">{format(v)}</span>
            </div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${w}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
