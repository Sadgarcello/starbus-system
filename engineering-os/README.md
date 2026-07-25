# Engineering OS

Personal engineering workspace â€” an interactive visual system for hardware/software projects. Runs entirely on your laptop with SQLite and local file storage.

**Not** project management software. This is a structured notebook for components, circuits, tests, problems, milestones, and notes.

## Architecture

```
engineering-os/
â”œâ”€â”€ backend/          Flask REST API (blueprints per domain)
â”‚   â”œâ”€â”€ app.py        Application factory
â”‚   â”œâ”€â”€ schema.sql    SQLite schema + extension tables (sensor_readings)
â”‚   â”œâ”€â”€ routes/       dashboard, overview, components, circuits, tests, â€¦
â”‚   â””â”€â”€ uploads/      Circuit images (gitignored contents)
â”œâ”€â”€ frontend/         Vite + React + React Router
â”‚   â””â”€â”€ src/pages/    One page per section
â””â”€â”€ data/             engineering_os.db (gitignored)
```

- **Backend** (port 5000): JSON REST API, CORS enabled for local dev
- **Frontend** (port 5173): proxies `/api` â†’ Flask
- **Database**: SQLite in `data/engineering_os.db`
- **Files**: circuit uploads in `backend/uploads/`

Future-ready: schema includes `sensor_readings` for ESP32/live telemetry; blueprints can be extended with WebSocket routes without restructuring.

## Prerequisites

- Python 3.10+
- Node.js 18+


## Quick start (Windows)

From `engineering-os/`:

```powershell
.\start.ps1
```

Opens two terminals (Flask + Vite). Use **http://127.0.0.1:5173** (Vite binds to IPv4 on Windows).

## Setup

### Backend

```powershell
cd engineering-os/backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python init_db.py
python app.py
```

Backend runs at http://127.0.0.1:5000

Health check: http://127.0.0.1:5000/api/health

### Frontend

In a second terminal:

```powershell
cd engineering-os/frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173

## Features (v1)

| Section | Description |
|---------|-------------|
| Dashboard | Project name, status, version, last update, progress %, tasks |
| Overview | Auto-saved title, problem, objective, outcomes, lessons |
| Components | Searchable BOM table with total cost |
| Circuits | Upload schematics/photos â€” gallery view, local filesystem |
| Testing | Test history with pass/fail |
| Problems | Problem / cause / solution / status cards |
| Timeline | Milestones chronologically |
| Notes | Quick notes with debounced auto-save |

## API Overview

All routes under `/api` (optional `?project_id=1` for future multi-project):

- `GET /api/dashboard` â€” stats + tasks
- `GET|PATCH /api/overview` â€” project narrative fields
- `GET|POST /api/components`, `PATCH|DELETE /api/components/:id`
- `GET|POST /api/circuits`, file upload via `multipart/form-data`
- `GET|POST /api/tests`, `GET|POST /api/problems`, `GET|POST /api/milestones`, `GET|POST /api/notes`
- `GET|POST /api/tasks`, `PATCH|DELETE /api/tasks/:id`

## Progress Calculation

When tasks exist, dashboard progress % = completed / total Ã— 100. With no tasks, the stored `progress_percent` on the project row is used.

## License

Private / local use.

