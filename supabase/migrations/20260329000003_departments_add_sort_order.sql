ALTER TABLE departments ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
NOTIFY pgrst, 'reload schema';
