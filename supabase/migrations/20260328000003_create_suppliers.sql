-- Suppliers table for expense tracking and reporting
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  eik text,
  vat_number text,
  address text,
  contact_person text,
  phone text,
  email text,
  iban text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_suppliers_eik ON suppliers (eik) WHERE eik IS NOT NULL;
CREATE INDEX idx_suppliers_name ON suppliers (name);

-- Link expenses to suppliers
ALTER TABLE expenses ADD COLUMN supplier_id uuid REFERENCES suppliers(id);

-- Migrate existing supplier names to the suppliers table
INSERT INTO suppliers (name, eik)
SELECT DISTINCT supplier, supplier_eik
FROM expenses
WHERE supplier IS NOT NULL AND supplier != '';

-- Update expenses to reference the new supplier records
UPDATE expenses e
SET supplier_id = s.id
FROM suppliers s
WHERE e.supplier = s.name AND COALESCE(e.supplier_eik, '') = COALESCE(s.eik, '');

-- RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')
  );

CREATE POLICY "suppliers_admin" ON suppliers
  FOR ALL TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
  ) WITH CHECK (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
  );
