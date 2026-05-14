# Starbus system

Primary work happens in **`starbus/`** — the Starbus booking / operations app.

## Starbus server (development)

From the repo root:

```powershell
cd starbus/server
npm install
npm run dev
```

Configure environment variables using `.env.railway.example` in `starbus/server/` as a template (copy to `.env` locally).

Database schema and notes: **`starbus/database/`**.

If you previously had local **`archive/`** snapshots (moon demo, legacy Flask site), they are not part of this workspace anymore—keep copies elsewhere if you still need them.
