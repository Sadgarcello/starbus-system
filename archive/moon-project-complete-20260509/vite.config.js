import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** GitHub Pages project sites live at /<repo-name>/ ; local dev stays at `/`. */
function appBasePath() {
  if (process.env.VITE_APP_BASE_URL) return process.env.VITE_APP_BASE_URL
  const inCi =
    process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
  if (inCi && process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1]
    if (repoName) return `/${repoName}/`
  }
  return '/'
}

export default defineConfig({
  base: appBasePath(),
  plugins: [react(), tailwindcss()],
})
