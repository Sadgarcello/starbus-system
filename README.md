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

## Archived projects

These are kept for reference; they are not the active focus.

| Path | Contents |
|------|----------|
| `archive/moon-project-complete-20260509/` | Finished React / Three.js moon experience (was deployed via GitHub Pages; workflow removed May 2026). |
| `archive/legacy-flask-20260503/` | Legacy Tru Boxing Flask site |

To run the archived moon UI locally:

```powershell
cd archive/moon-project-complete-20260509
npm ci
npm run dev
```

GitHub Pages for the moon project is no longer built from this repository; use a local preview or redeploy manually if you ever need it again.
