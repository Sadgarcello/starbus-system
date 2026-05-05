-- Starbus 2.0 (Foundation) — MariaDB schema
-- Target: MariaDB 10.4 (XAMPP)

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Create DB (optional). Comment out if you manage DB elsewhere.
-- CREATE DATABASE IF NOT EXISTS starbus
--   CHARACTER SET utf8mb4
--   COLLATE utf8mb4_unicode_ci;
-- USE starbus;

-- ===== USERS =====
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)    NOT NULL,
  email         VARCHAR(255)    NOT NULL,
  password      VARCHAR(255)    NOT NULL,
  role          ENUM('superadmin','admin','worker','owner','driver') NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_created_at (created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ===== ROUTES =====
CREATE TABLE IF NOT EXISTS routes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  origin      VARCHAR(120)    NOT NULL,
  destination VARCHAR(120)    NOT NULL,
  price       DECIMAL(10,2)   NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_routes_od (origin, destination),
  KEY idx_routes_origin (origin),
  KEY idx_routes_destination (destination)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ===== BUSES =====
CREATE TABLE IF NOT EXISTS buses (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bus_owner_id    BIGINT UNSIGNED NOT NULL,
  bus_number      VARCHAR(50)     NOT NULL,
  total_seats     INT UNSIGNED    NOT NULL,
  seats_booked    INT UNSIGNED    NOT NULL DEFAULT 0,
  departure_time  TIME            NOT NULL,
  route_id        BIGINT UNSIGNED NOT NULL,
  date            DATE            NOT NULL,
  status          ENUM('scheduled','departed','cancelled','sold_out') NOT NULL DEFAULT 'scheduled',
  PRIMARY KEY (id),
  UNIQUE KEY uq_buses_route_date_time_number (route_id, date, departure_time, bus_number),
  KEY idx_buses_owner_date (bus_owner_id, date),
  KEY idx_buses_route_date (route_id, date),
  KEY idx_buses_status (status),
  CONSTRAINT fk_buses_owner
    FOREIGN KEY (bus_owner_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_buses_route
    FOREIGN KEY (route_id) REFERENCES routes(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- ===== BOOKINGS =====
CREATE TABLE IF NOT EXISTS bookings (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bus_id           BIGINT UNSIGNED NOT NULL,
  worker_id        BIGINT UNSIGNED NOT NULL,
  passenger_name   VARCHAR(120)    NULL,
  passenger_phone  VARCHAR(32)     NULL,
  passenger_email  VARCHAR(255)    NULL,
  from_location    VARCHAR(120)    NOT NULL,
  to_location      VARCHAR(120)    NOT NULL,
  seat_number      INT UNSIGNED    NOT NULL,
  booking_type     ENUM('online','booth') NOT NULL,
  payment_status   ENUM('paid','unpaid','half')  NOT NULL DEFAULT 'unpaid',
  lifecycle        ENUM('reserved','full')      NOT NULL DEFAULT 'full',
  created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_bus_seat (bus_id, seat_number),
  KEY idx_bookings_bus_created (bus_id, created_at),
  KEY idx_bookings_worker_created (worker_id, created_at),
  KEY idx_bookings_payment_status (payment_status),
  CONSTRAINT fk_bookings_bus
    FOREIGN KEY (bus_id) REFERENCES buses(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_bookings_worker
    FOREIGN KEY (worker_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_bookings_seat_number_pos CHECK (seat_number > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Notes:
-- - seats_remaining is computed in SQL/API as (total_seats - seats_booked), not stored.
-- - uq_bookings_bus_seat prevents double-booking the same seat on a bus.
-- - revenue: SUM(routes.price) for paid bookings (join bookings -> buses -> routes).

