-- Adds an "Online Channel" placeholder user used as worker_id for bookings
-- created from the public customer page. Password is a valid bcrypt hash for a
-- secret string so login always returns "Invalid credentials" (do not share).
--
-- New installs: use seed.sql (includes online@starbus.sd). Run this only for
-- existing DBs missing that row.
--
-- Run once:  mysql -u root -p starbus < migration_online_user.sql

SET NAMES utf8mb4;

INSERT INTO users (name, email, password, role)
VALUES (
  'Online Channel',
  'online@starbus.sd',
  '$2a$10$8TbtQ.kBgbxRr8hYpMi3Cu7Z82Tq1vOpokVgmDDd1XZVPWOcLyYsO',
  'worker'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role);

-- Sanity check
SELECT id, name, email, role FROM users WHERE email = 'online@starbus.sd';
