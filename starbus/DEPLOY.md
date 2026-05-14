# Starbus — deploy without a domain or VPS (GitHub + PaaS)

Your **live URL** is provided by the host (for example `https://starbus.onrender.com`). **GitHub** only stores code; it does not run the app.

## Repository layout

- **Monorepo root**: this repo (e.g. `tru-rec-website`).
- **Runnable app**: [`server/`](server/) — set the PaaS **root directory** to `starbus/server`, or use the repo-root [`render.yaml`](../render.yaml) Blueprint.

## One-time: database (MySQL-compatible)

Use any managed MySQL 8 (or MariaDB-compatible) instance: same PaaS MySQL add-on, **PlanetScale**, **Railway MySQL**, **Aiven**, etc. Collect:

- `DB_HOST`, `DB_PORT` (often `3306`), `DB_USER`, `DB_PASSWORD`, `DB_NAME`

### SQL apply order

1. **[`database/schema.sql`](database/schema.sql)** — base tables (run on an empty database).
2. If you already had an **old** Starbus DB without lifecycle / nullable passengers, run **[`database/migration_add_lifecycle.sql`](database/migration_add_lifecycle.sql)** once (safe to skip on fresh schema).
3. **[`database/seed.sql`](database/seed.sql)** — routes, staff users, optional **`online@starbus.sd`** (legacy online channel user), and **today’s** buses from Omdurman.

`seed.sql` deletes **today’s** bookings and buses for `CURDATE()` before inserting fresh buses — re-run when you need a clean day.

**“No trips today” on Railway:** the API defaults to **`DB_SERVICE_TIMEZONE=+02:00`** (Sudan calendar day) so `CURDATE()` matches local operations; `seed.sql` uses the same offset. Deploy the app with that env (or omit it for the default), then run **`npm run apply-seed`** so rows exist for that calendar day.

**Railway / cloud without pasting SQL in the dashboard:** from [`server/`](server/), put MySQL **Connect** values in `server/.env.railway` (see [`server/.env.railway.example`](server/.env.railway.example)), then run **`npm run apply-seed`** — it applies `database/seed.sql` over the network (same TLS behavior as `set-password`).

**Customer flow:** the public site **does not** create database rows. Customers pick seats and send a **WhatsApp** message; staff confirm bookings in **`/worker`**. Only workers create `reserved` / confirmed rows via the authenticated API.

## Render (recommended for this repo)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo — Render reads [`render.yaml`](../render.yaml).
3. When prompted, fill **sync: false** variables: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `WHATSAPP_NUMBER` (digits only, country code first, e.g. `249…`).
4. `JWT_SECRET` is auto-generated unless you override it in the dashboard.
5. After deploy succeeds, run the SQL files against your cloud DB (Render **Shell**, local `mysql` client, or provider UI).
6. Open `https://<your-service>.onrender.com/` (customer), `/worker`, `/admin`.

**Free tier**: the service may **spin down** when idle; first request after idle can be slow. For a steady morning rush, upgrade to a paid **always-on** plan on the same URL.

## Environment variables (reference)

| Variable | Required | Notes |
|----------|----------|--------|
| `PORT` | No | Set by PaaS; local default in `.env.example`. |
| `DB_*` | Yes | Cloud MySQL connection. |
| `JWT_SECRET` | Yes | Long random string; server exits if missing. |
| `JWT_EXPIRES_IN` | No | Default `7d`. |
| `WHATSAPP_NUMBER` | Yes for WA link | Digits only; [`public.js`](server/src/routes/public.js) strips non-digits. |
| `CORS_ORIGINS` | No | Empty = allow any origin (ok for single-origin UI). |
| `TRUST_PROXY` | No | Default: trust 1 proxy hop (`X-Forwarded-For`) so `/api/public` limits use the real client IP. Set `0` to disable (rare). |
| `PUBLIC_GLOBAL_*` | No | Default ~120 `/api/public` requests per IP per minute; stops naive flooding. See `.env.example`. |
| `RESERVE_RATE_*` | No | **Unused** — public `/bookings/reserve*` returns 403; kept in `.env.example` for reference only. |

Copy [`server/.env.example`](server/.env.example) to `server/.env` locally (never commit `.env`).

## Smoke test (local)

With DB running and `npm start` in `starbus/server`:

```bash
cd starbus/server
npm run smoke
```

Optional login check:

```bash
set SMOKE_EMAIL=worker@starbus.sd
set SMOKE_PASSWORD=changeme
npm run smoke
```

Override base URL:

```bash
set SMOKE_BASE_URL=https://your-service.onrender.com
npm run smoke
```

## Later: custom domain + VPS

Same codebase: point DNS to the PaaS or move Node + MySQL to a VPS; update `DB_*` and redeploy.
