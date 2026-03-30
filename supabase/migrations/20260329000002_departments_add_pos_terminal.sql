-- Add POS terminal reference to departments (now "points of sale")
ALTER TABLE departments ADD COLUMN IF NOT EXISTS pos_terminal_id uuid REFERENCES pos_terminals(id);

NOTIFY pgrst, 'reload schema';
