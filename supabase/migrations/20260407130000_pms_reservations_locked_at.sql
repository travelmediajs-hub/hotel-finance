-- Заключване на стари (затворени) резервации.
-- При daily sync upsert-ът прескача редове, при които locked_at IS NOT NULL.
-- Само ADMIN_CO може да ги отключи / ресинкне ръчно.

alter table pms_reservations
  add column if not exists locked_at timestamptz;

create index if not exists idx_pms_res_locked_at
  on pms_reservations(locked_at)
  where locked_at is null;

-- Помощна функция: заключи всички резервации, чийто to_date е преди (днес - N дни)
create or replace function lock_old_pms_reservations(days_old int default 7)
returns int
language plpgsql
as $$
declare
  affected int;
begin
  update pms_reservations
    set locked_at = now()
    where locked_at is null
      and to_date < (current_date - days_old);
  get diagnostics affected = row_count;
  return affected;
end;
$$;
