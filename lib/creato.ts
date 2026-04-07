// Shared helpers for Creato Solutions PMS integration.

export const EUR_RATE = 1.95583
export const toEur = (amount: number, curr?: string | null) =>
  curr === 'BGN' ? amount / EUR_RATE : amount

export interface CreatoReservation {
  Id?: string | number
  IdRes?: string | number
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
  [k: string]: unknown
}

export async function fetchCreatoReservations(params: {
  from: string // yyyy-mm-dd
  to: string // yyyy-mm-dd
  token: string
  hotelId: string
  baseUrl?: string
  expandDays?: number
  signal?: AbortSignal
}): Promise<CreatoReservation[]> {
  const baseUrl = params.baseUrl || 'https://api.creato.solutions/index.php'
  const expand = params.expandDays ?? 30
  const f = new Date(params.from)
  f.setDate(f.getDate() - expand)
  const extFrom = f.toISOString().slice(0, 10)
  const url = `${baseUrl}?token=${encodeURIComponent(params.token)}&id=${encodeURIComponent(
    params.hotelId,
  )}&get-reservations&StayFrom=${extFrom}&StayTo=${params.to}`

  const r = await fetch(url, { signal: params.signal, cache: 'no-store' })
  const text = await r.text()
  if (text.trim().startsWith('<')) {
    throw new Error('Creato върна HTML — провери token/id')
  }
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Невалиден JSON от Creato')
  }
  if (json.error !== 0) {
    throw new Error('Creato грешка: ' + JSON.stringify(json).slice(0, 200))
  }
  return (json.result?.data ?? []) as CreatoReservation[]
}

// Try to extract a stable reservation id from a Creato row. Creato uses
// inconsistent field names across endpoints, so we try a bunch and fall back
// to a hash of the key fields to guarantee uniqueness.
export function extractReservationId(r: any): string {
  const candidates = [
    'IdNum',
    'IdExtNum',
    'Id',
    'IdRes',
    'IdReservation',
    'ResId',
    'ReservationId',
    'IdResv',
    'IdBooking',
    'BookingId',
    'ResNo',
    'ResNumber',
    'NomerRez',
    'Nomer',
  ]
  for (const k of candidates) {
    const v = r?.[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  // Fallback: deterministic hash of identifying fields
  const sig = [
    r?.FromDate,
    r?.ToDate,
    r?.BookDate,
    r?.IdRoom,
    r?.Total,
    r?.Status,
  ].join('|')
  let h = 0
  for (let i = 0; i < sig.length; i++) h = ((h << 5) - h + sig.charCodeAt(i)) | 0
  return 'h_' + Math.abs(h).toString(36) + '_' + (r?.FromDate || '')
}

// Map raw Creato row to a DB-friendly shape (matches pms_reservations columns).
export function mapReservationToRow(
  r: CreatoReservation,
  ctx: { propertyId: string | null; pmsHotelId: string },
) {
  const total = parseFloat(String(r.Total ?? 0)) || 0
  const pen = parseFloat(String(r.Penalties ?? 0)) || 0
  // До 31.12.2025 хотелът отчита в лева — независимо какво връща Creato в IdCurr
  // (понякога липсва), приемаме BGN и конвертираме по фиксинг.
  // Postgres отказва "0000-00-00" — нормализирай към null.
  const cleanDate = (v: unknown) => {
    const s = v == null ? '' : String(v).trim()
    if (!s || s.startsWith('0000') || s === 'null') return null
    return s
  }
  const fromDate = cleanDate(r.FromDate)
  const toDate = cleanDate(r.ToDate)
  const bookDate = cleanDate(r.BookDate)
  const eurCurr = r.IdCurr ?? null
  return {
    property_id: ctx.propertyId,
    pms_hotel_id: ctx.pmsHotelId,
    pms_res_id: extractReservationId(r),
    status: r.Status ?? null,
    from_date: fromDate,
    to_date: toDate,
    book_date: bookDate,
    days: r.Days != null ? parseInt(String(r.Days)) || null : null,
    id_room: r.IdRoom ?? null,
    id_ext_board: r.IdExtBoard ?? null,
    source: r.Source ?? null,
    channel: r.Channel ?? null,
    company: r.Company ?? null,
    total,
    total_eur: toEur(total, eurCurr),
    penalties: pen,
    penalties_eur: toEur(pen, eurCurr),
    currency: eurCurr,
    raw: r as any,
    synced_at: new Date().toISOString(),
  }
}
