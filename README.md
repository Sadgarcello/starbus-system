# tru-rec-website

## Moon Project (React + Three.js experience)

Friends can open it in **Chrome or Safari on a phone** — layout uses safe areas, dynamic viewport heights, and touch-friendly tap targets.

### Run locally

```bash
cd moon-project
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Production build checks:

```bash
cd moon-project
npm ci
npm run build
npm run preview
```

### Live site on GitHub Pages

This repo ships the **moon-project** folder to GitHub Actions → Pages.

1. On GitHub: **Settings → Pages → Build and deployment**.
2. Set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. Push to **`main`**; the workflow **[Deploy Moon Project to GitHub Pages](.github/workflows/deploy-moon-pages.yml)** builds and publishes.

Published URL shape:

`https://<your-username>.github.io/starbus-system/`

(Uses the repo name as the URL path.)

### Other folders

Legacy Flask assets may live under `archive/`; they are optional and large, so many snapshots are kept out of git by choice.

### Ambient audio (optional)

`AudioController` loads `/audio/ambient.mp3` after you enter the experience. That file was not bundled in git in some setups — add **`moon-project/public/audio/ambient.mp3`** locally (and push) if you want the background loop everywhere; otherwise the app still runs without it.