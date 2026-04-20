-- Helper CTE: (row_key, account_code) pairs
WITH pairs(row_key, account_code) AS (
  VALUES
    -- Revenue
    ('accommodation_revenue', '1101'),
    ('fb_revenue',            '3101'),
    -- F&B expenses
    ('food_vegetables',       '9520'),
    ('soft_drinks_coffee',    '9521'),
    ('hotel_supplies',        '9522'),
    -- Utilities
    ('electricity',           '9530'),
    ('heating_pellets',       '9501'),
    ('water',                 '9531'),
    ('lpg',                   '9532'),
    -- Other expenses
    ('other_expenses',        '9540'),
    ('local_tax_per_night',   '9502'),
    ('laundry',               '9503'),
    ('software',              '9504'),
    ('tv_tel_internet',       '9505'),
    ('extraordinary',         '9506'),
    ('overbooking',           '9507'),
    ('accounting',            '9508'),
    ('booking_com_commission','9509'),
    ('facebook_ads',          '9510')
)
INSERT INTO opreport_row_accounts (row_id, account_id)
SELECT r.id, a.id
FROM pairs p
JOIN opreport_rows  r ON r.row_key = p.row_key
JOIN usali_accounts a ON a.code    = p.account_code
ON CONFLICT DO NOTHING;

-- Sanity: count expected mappings
DO $$
DECLARE
  mapped int;
BEGIN
  SELECT COUNT(*) INTO mapped FROM opreport_row_accounts;
  IF mapped < 19 THEN
    RAISE EXCEPTION 'Expected at least 19 row-account mappings, got %', mapped;
  END IF;
END $$;
