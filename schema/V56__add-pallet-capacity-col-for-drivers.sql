ALTER TABLE driver ADD COLUMN pallet_capacity INT DEFAULT 0 CHECK (pallet_capacity BETWEEN 0 AND 5);

