/**
 * Prefix Vite `base` so files in `public/` work on GitHub Pages (e.g. /repo-name/).
 * Idempotent: paths that already include `base` are returned unchanged.
 */
export function publicAsset(path) {
  if (path == null || path === '') return path
  if (
    /^https?:\/\//i.test(path) ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path
  }

  const base = import.meta.env.BASE_URL
  const normalizedBase =
    base.endsWith('/') && base.length > 1 ? base.slice(0, -1) : base
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (
    normalizedBase &&
    normalizedBase !== '/' &&
    (normalized === normalizedBase ||
      normalized.startsWith(`${normalizedBase}/`))
  ) {
    return normalized
  }

  const trimmed = normalized.replace(/^\/+/, '')
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${trimmed}`
}
