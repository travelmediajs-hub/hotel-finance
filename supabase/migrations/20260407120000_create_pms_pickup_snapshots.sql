-- Леки snapshots за Pickup отчета.
-- Не пазим цели резервации — само агрегирани метрики по дата на престой.
-- Един ред = един snapshot_date × stay_date × property → on-the-books метрики.

create table if not exists pms_pickup_snapshots (
  id bigserial primary key,
  property_id uuid references properties(id) on delete cascade,
  snapshot_date date not null, -- датата на самия snapshot (когато sync е пуснат)
  stay_date date not null,     -- датата на нощуването
  nights int not null default 0,
  revenue_eur numeric(12,2) not null default 0,
  reservations int not null default 0,
  created_at timestamptz default now(),
  unique (property_id, snapshot_date, stay_date)
);

create index if not exists idx_pickup_snap_property_date
  on pms_pickup_snapshots (property_id, snapshot_date desc, stay_date);

alter table pms_pickup_snapshots enable row level security;

create policy "pickup_snap_select" on pms_pickup_snapshots
  for select using (
    property_id is null or has_property_access(property_id)
  );

create policy "pickup_snap_insert" on pms_pickup_snapshots
  for insert with check (
    property_id is null or has_property_access(property_id)
  );
