-- ============================================================
-- PMS reservations cache (Creato Solutions)
-- Stores raw reservations pulled from Creato so the Revenue
-- dashboard can read fast and run YoY comparisons.
-- ============================================================

CREATE TABLE IF NOT EXISTS pms_reservations (
  id              bigserial PRIMARY KEY,
  property_id     uuid REFERENCES properties(id) ON DELETE CASCADE,
  pms_hotel_id    text NOT NULL,           -- Creato hotel id
  pms_res_id      text NOT NULL,           -- Reservation id from Creato (Id / IdRes)
  status          text,                    -- OK, OUT, ST, ASK, WT
  from_date       date,
  to_date         date,
  book_date       date,
  days            int,
  id_room         text,
  id_ext_board    text,
  source          text,
  channel         text,
  company         text,
  total           numeric(14,2),
  total_eur       numeric(14,2),           -- pre-converted for fast aggregation
  penalties       numeric(14,2),
  penalties_eur   numeric(14,2),
  currency        text,
  raw             jsonb NOT NULL,          -- full raw row for safety
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pms_hotel_id, pms_res_id)
);

CREATE INDEX IF NOT EXISTS pms_reservations_property_idx
  ON pms_reservations (property_id);
CREATE INDEX IF NOT EXISTS pms_reservations_from_date_idx
  ON pms_reservations (from_date);
CREATE INDEX IF NOT EXISTS pms_reservations_to_date_idx
  ON pms_reservations (to_date);
CREATE INDEX IF NOT EXISTS pms_reservations_status_idx
  ON pms_reservations (status);

-- Sync log (one row per sync run, useful for "last synced" badge)
CREATE TABLE IF NOT EXISTS pms_sync_log (
  id            bigserial PRIMARY KEY,
  property_id   uuid REFERENCES properties(id) ON DELETE CASCADE,
  pms_hotel_id  text NOT NULL,
  range_from    date NOT NULL,
  range_to      date NOT NULL,
  rows_upserted int NOT NULL DEFAULT 0,
  ok            boolean NOT NULL DEFAULT true,
  error         text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

CREATE INDEX IF NOT EXISTS pms_sync_log_property_idx
  ON pms_sync_log (property_id, started_at DESC);

-- ============================================================
-- RLS — read scoped by property access; writes only via service role
-- (the API route uses the service role key to upsert).
-- ============================================================
ALTER TABLE pms_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_sync_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY pms_reservations_select ON pms_reservations FOR SELECT
  USING (property_id IS NULL OR public.has_property_access(property_id));

CREATE POLICY pms_sync_log_select ON pms_sync_log FOR SELECT
  USING (property_id IS NULL OR public.has_property_access(property_id));
