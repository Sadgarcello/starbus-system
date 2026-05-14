# Starbus database files

Apply in this order on a **new** cloud or local database:

1. **`schema.sql`** — creates `users`, `routes`, `buses`, `bookings`.
2. **`seed.sql`** — routes, staff users (including **`online@starbus.sd`** for the public booking channel), and buses for **`CURDATE()`** in the **session timezone** (use **`npm run apply-seed`** from `server/` so it matches `DB_SERVICE_TIMEZONE`, default `+02:00`). For bare `mysql < seed.sql`, set the same `time_zone` in that session first.

**Upgrade path** (existing DB created before lifecycle columns):

- Run **`migration_add_lifecycle.sql`** once if those columns are missing.

**Upgrade path** (multi-tenant workers):

- Run **`migration_add_employer_user_id.sql`** once if `users.employer_user_id` is missing. Re-login for worker accounts after setting `employer_user_id`.

**Legacy** (optional):

- **`migration_online_user.sql`** — only if you need the online user row without re-running full `seed.sql`. New installs get this from `seed.sql`.

Individual SQL patches like `set_user_monsterawab.sql` are optional dev helpers.
