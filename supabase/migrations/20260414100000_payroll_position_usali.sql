-- Add position field and switch to USALI department classification
ALTER TABLE employees ADD COLUMN position text;
ALTER TABLE employees ADD COLUMN usali_department_id uuid REFERENCES usali_department_templates(id) ON DELETE RESTRICT;

-- Backfill usali_department_id from departments if possible (best effort)
-- Then drop old department_id
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_department_id_fkey;
ALTER TABLE employees DROP COLUMN IF EXISTS department_id;

CREATE INDEX idx_employees_usali_dept ON employees(usali_department_id);
