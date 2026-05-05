-- Starbus — Soft launch seed (route = bus of the day from Omdurman)
-- Each destination has its own bus row for TODAY (CURDATE).
-- Layout: 46 seats (see server busLayout.js)
--
-- === Dev setup (read this once) ===
-- 1) Create tables:  mysql -u root -p starbus < schema.sql
-- 2) Load this file:  mysql -u root -p starbus < seed.sql
-- 3) Run API:         cd starbus/server && npm install && npm run dev
-- 4) Open UI:         http://127.0.0.1:<PORT>/worker  and  /admin  (PORT = your .env, often 4001)
--
-- Dev passwords:
--   superadmin@starbus.sd   / changeme     superadmin
--   worker@starbus.sd       / changeme     worker
--   monsterawab@gmail.com     / awab2637     superadmin (your account; Admin + Worker UIs)
--
-- If login says "Invalid credentials", that email is not in DB — run this seed (or the SQL patch below).
-- Custom users: run set_user_monsterawab.sql or:
--   cd starbus/server && node src/scripts/hash-password.js 'your-password'
--   then UPDATE users SET password = '<paste hash>' WHERE email = '...';
--
-- Re-running seed on the same calendar day wipes TODAY's bookings + buses, then inserts 3 buses.
-- If "No buses today" but you expect some: DB server date (CURDATE) vs seed day, or script not run.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

START TRANSACTION;

ALTER TABLE users
  MODIFY role ENUM('superadmin','admin','worker','owner','driver') NOT NULL;

INSERT INTO routes (origin, destination, price)
VALUES
  ('Omdurman', 'Khartoum', 0.00),
  ('Omdurman', 'Port Sudan', 0.00),
  ('Omdurman', 'Kassala', 0.00)
ON DUPLICATE KEY UPDATE price = VALUES(price);

-- bcrypt for plaintext password: changeme (regenerate: node starbus/server/src/scripts/hash-password.js changeme)
INSERT INTO users (name, email, password, role)
VALUES
  (
    'Super Admin',
    'superadmin@starbus.sd',
    '$2a$10$6wEWSZAgcNGFCZOIJfanQ.Fv8Q2uiEbL8trvTADEOdBXGNXo5SQC6',
    'superadmin'
  ),
  (
    'Booth Worker',
    'worker@starbus.sd',
    '$2a$10$6wEWSZAgcNGFCZOIJfanQ.Fv8Q2uiEbL8trvTADEOdBXGNXo5SQC6',
    'worker'
  ),
  (
    'Online Channel',
    'online@starbus.sd',
    '$2a$10$8TbtQ.kBgbxRr8hYpMi3Cu7Z82Tq1vOpokVgmDDd1XZVPWOcLyYsO',
    'worker'
  ),
  (
    'Awab',
    'monsterawab@gmail.com',
    '$2a$10$/Uw6.GvlMpZpvoTva0y4/eSCKRAhYLUIcEET6dO8tl1ukJAvaWGlW',
    'superadmin'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password = VALUES(password),
  role = VALUES(role);

-- Fresh day: clear today’s trip data (bookings + bus rows for today only)
DELETE bk FROM bookings bk
JOIN buses b ON b.id = bk.bus_id
WHERE b.date = CURDATE();

DELETE FROM buses WHERE date = CURDATE();

-- Bus 1 = Omdurman → Kassala, Bus 2 = Port Sudan, Bus 3 = Khartoum
INSERT INTO buses (bus_owner_id, bus_number, total_seats, seats_booked, departure_time, route_id, date, status)
SELECT
  (SELECT id FROM users WHERE email = 'superadmin@starbus.sd' LIMIT 1),
  '1',
  46,
  0,
  '08:00:00',
  (SELECT id FROM routes WHERE origin = 'Omdurman' AND destination = 'Kassala' LIMIT 1),
  CURDATE(),
  'scheduled'
FROM DUAL;

INSERT INTO buses (bus_owner_id, bus_number, total_seats, seats_booked, departure_time, route_id, date, status)
SELECT
  (SELECT id FROM users WHERE email = 'superadmin@starbus.sd' LIMIT 1),
  '2',
  46,
  0,
  '08:00:00',
  (SELECT id FROM routes WHERE origin = 'Omdurman' AND destination = 'Port Sudan' LIMIT 1),
  CURDATE(),
  'scheduled'
FROM DUAL;

INSERT INTO buses (bus_owner_id, bus_number, total_seats, seats_booked, departure_time, route_id, date, status)
SELECT
  (SELECT id FROM users WHERE email = 'superadmin@starbus.sd' LIMIT 1),
  '3',
  46,
  0,
  '08:00:00',
  (SELECT id FROM routes WHERE origin = 'Omdurman' AND destination = 'Khartoum' LIMIT 1),
  CURDATE(),
  'scheduled'
FROM DUAL;

COMMIT;
