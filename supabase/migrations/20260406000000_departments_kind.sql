-- Split departments into REVENUE (POS points) and EXPENSE (cost categories)
ALTER TABLE departments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'EXPENSE'
  CHECK (kind IN ('REVENUE','EXPENSE'));

-- Mark standard revenue points as REVENUE
UPDATE departments SET kind='REVENUE'
  WHERE name IN ('Рецепция','Ресторант','Лоби Бар','Front Desk','Reception','Restaurant','Lobby Bar');

CREATE INDEX IF NOT EXISTS idx_departments_kind ON departments(property_id, kind, status);
