# Starbus system

Monorepo for multiple apps. Each app has its own folder, README, and Vercel project.

## Apps

| Folder | Product | Deploy on Vercel |
|--------|---------|----------------|
| **`english-os/`** | **Khawaja Club** — English academy (students, speaking, reading, writing, listening) | Root directory: `english-os` |
| **`sudan-record-system/`** | المرصد — records / archive system | Root directory: `sudan-record-system` |
| **`starbus/`** | Starbus booking / operations API | Railway / server deploy |
| **`starbus-game/`** | Starbus Tycoon game | Static or separate host |

## Khawaja Club (english-os)

```powershell
cd english-os
cp .env.example .env
npm install
npm run dev
```

See **`english-os/README.md`** for Supabase migrations and go-live checklist.

**Vercel:** import this repo, set **Root Directory** to `english-os`, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Starbus server

```powershell
cd starbus/server
npm install
npm run dev
```

Configure environment using `.env.railway.example` in `starbus/server/`. Database: **`starbus/database/`**.

## Starbus Tycoon

```powershell
cd starbus-game
npm install
npm run dev
```

## Notes

- Do not keep a second copy of `english-os` outside this repo — work only in **`starbus-system/english-os/`**.
- Each frontend app includes its own `vercel.json` for SPA routing.
