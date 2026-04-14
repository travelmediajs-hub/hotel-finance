CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_auth" ON positions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Standard hotel positions
INSERT INTO positions (name, sort_order) VALUES
  ('Управител', 10),
  ('Зам. управител', 15),
  ('Рецепционист', 20),
  ('Портиер', 25),
  ('Камериерка', 30),
  ('Готвач', 40),
  ('Помощник готвач', 45),
  ('Сервитьор', 50),
  ('Барман', 55),
  ('Миячка', 60),
  ('Спа терапевт', 70),
  ('Спасител', 75),
  ('Аниматор', 80),
  ('Счетоводител', 90),
  ('Касиер', 95),
  ('Поддръжка', 100),
  ('Охрана', 110),
  ('Градинар', 120),
  ('Шофьор', 130),
  ('Чистач/Хигиенист', 140);

-- Change employees.position from text to FK
ALTER TABLE employees DROP COLUMN IF EXISTS position;
ALTER TABLE employees ADD COLUMN position_id uuid REFERENCES positions(id) ON DELETE RESTRICT;
CREATE INDEX idx_employees_position ON employees(position_id);
