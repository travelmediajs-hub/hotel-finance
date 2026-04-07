-- Backfill suppliers from existing expenses and link supplier_id
INSERT INTO suppliers (name, is_active)
SELECT DISTINCT supplier, true FROM expenses
WHERE supplier IS NOT NULL AND supplier <> ''
  AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.name = expenses.supplier);

UPDATE expenses e
SET supplier_id = s.id
FROM suppliers s
WHERE e.supplier_id IS NULL AND e.supplier = s.name;
