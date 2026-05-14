-- Links worker accounts to their employer (bus owner admin user).
-- Run once on existing DBs: mysql ... < migration_add_employer_user_id.sql
-- Fresh installs: already included in schema.sql

SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN employer_user_id BIGINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Bus owner (users.id) this worker operates under'
    AFTER role,
  ADD KEY idx_users_employer (employer_user_id),
  ADD CONSTRAINT fk_users_employer
    FOREIGN KEY (employer_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE;
