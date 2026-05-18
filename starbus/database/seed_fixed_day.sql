-- Starbus — three Omdurman buses on one calendar day (fixed `date`).
--
-- Prerequisites: routes + users from seed.sql (`superadmin@starbus.sd` etc.).
--
-- `@service_day` must be set in the session (see `npm run apply-seed-day`).
-- Safe to run again: skips inserts when `(route_id, date, departure_time, bus_number)` already exists.

SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO buses (bus_owner_id, bus_number, total_seats, seats_booked, departure_time, route_id, date, status)
SELECT
  (SELECT id FROM users WHERE email = 'superadmin@starbus.sd' LIMIT 1),
  '1',
  46,
  0,
  '08:00:00',
  (SELECT id FROM routes WHERE origin = 'Omdurman' AND destination = 'Kassala' LIMIT 1),
  @service_day,
  'scheduled'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM buses b
  INNER JOIN routes r ON r.id = b.route_id
  WHERE r.origin = 'Omdurman' AND r.destination = 'Kassala'
    AND b.date = @service_day
    AND b.departure_time = '08:00:00'
    AND b.bus_number = '1'
);

INSERT INTO buses (bus_owner_id, bus_number, total_seats, seats_booked, departure_time, route_id, date, status)
SELECT
  (SELECT id FROM users WHERE email = 'superadmin@starbus.sd' LIMIT 1),
  '2',
  46,
  0,
  '08:00:00',
  (SELECT id FROM routes WHERE origin = 'Omdurman' AND destination = 'Port Sudan' LIMIT 1),
  @service_day,
  'scheduled'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM buses b
  INNER JOIN routes r ON r.id = b.route_id
  WHERE r.origin = 'Omdurman' AND r.destination = 'Port Sudan'
    AND b.date = @service_day
    AND b.departure_time = '08:00:00'
    AND b.bus_number = '2'
);

INSERT INTO buses (bus_owner_id, bus_number, total_seats, seats_booked, departure_time, route_id, date, status)
SELECT
  (SELECT id FROM users WHERE email = 'superadmin@starbus.sd' LIMIT 1),
  '3',
  46,
  0,
  '08:00:00',
  (SELECT id FROM routes WHERE origin = 'Omdurman' AND destination = 'Khartoum' LIMIT 1),
  @service_day,
  'scheduled'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM buses b
  INNER JOIN routes r ON r.id = b.route_id
  WHERE r.origin = 'Omdurman' AND r.destination = 'Khartoum'
    AND b.date = @service_day
    AND b.departure_time = '08:00:00'
    AND b.bus_number = '3'
);

COMMIT;
