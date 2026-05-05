-- Run once on existing DB after pulling this version.
-- If you get "Duplicate column", the column already exists — skip.

ALTER TABLE bookings
  ADD COLUMN lifecycle ENUM('reserved','full') NOT NULL DEFAULT 'full' AFTER payment_status;

ALTER TABLE bookings
  MODIFY passenger_name VARCHAR(120) NULL;

UPDATE bookings SET lifecycle = 'full';
