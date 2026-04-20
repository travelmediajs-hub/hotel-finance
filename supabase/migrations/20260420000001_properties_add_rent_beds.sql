ALTER TABLE properties
  ADD COLUMN rooms_main       int NOT NULL DEFAULT 0,
  ADD COLUMN rooms_annex      int NOT NULL DEFAULT 0,
  ADD COLUMN total_beds       int NOT NULL DEFAULT 0,
  ADD COLUMN operating_months int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
  ADD COLUMN annual_rent      decimal(12,2) NOT NULL DEFAULT 0;

-- Sanity constraints
ALTER TABLE properties
  ADD CONSTRAINT properties_operating_months_nonempty
    CHECK (array_length(operating_months, 1) >= 1),
  ADD CONSTRAINT properties_operating_months_range
    CHECK (operating_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::int[]),
  ADD CONSTRAINT properties_rooms_nonneg
    CHECK (rooms_main >= 0 AND rooms_annex >= 0 AND total_beds >= 0),
  ADD CONSTRAINT properties_annual_rent_nonneg
    CHECK (annual_rent >= 0);
