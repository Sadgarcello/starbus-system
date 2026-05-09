# Archived: moon experience (May 2026)

This tree is a frozen snapshot of the personal React + Vite + Three.js moon project. Active development moved to **`starbus/`** at the repo root.

**Local preview**

```bash
npm ci
npm run dev
```

The repository no longer publishes this app via GitHub Actions; treat this folder as archival only unless you revive a Pages workflow pointing here.

---

## React + Vite (upstream template notes)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with TypeScript ESLint configured for type-aware rules. See [the TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts).
