-- Employees table
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  contract_salary numeric(12,2) NOT NULL DEFAULT 0,
  actual_salary numeric(12,2) NOT NULL DEFAULT 0,
  contract_hours_per_day smallint NOT NULL DEFAULT 8,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_property ON employees(property_id);
CREATE INDEX idx_employees_department ON employees(department_id);

-- Employee schedule table
CREATE TABLE employee_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('WORK', 'REST', 'LEAVE', 'SICK')),
  hours numeric(4,1),
  overtime_hours numeric(4,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_employee_schedule_date ON employee_schedule(employee_id, date);

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_auth" ON employees
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "employee_schedule_auth" ON employee_schedule
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
