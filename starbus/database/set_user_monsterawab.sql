-- Upsert Awab / monsterawab@gmail.com — password awab2637, superadmin (Admin + Worker UIs).
-- Run if you did not re-run seed.sql:  mysql -u root -p starbus < set_user_monsterawab.sql

SET NAMES utf8mb4;

INSERT INTO users (name, email, password, role)
VALUES (
  'Awab',
  'monsterawab@gmail.com',
  '$2a$10$/Uw6.GvlMpZpvoTva0y4/eSCKRAhYLUIcEET6dO8tl1ukJAvaWGlW',
  'superadmin'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password = VALUES(password),
  role = VALUES(role);
