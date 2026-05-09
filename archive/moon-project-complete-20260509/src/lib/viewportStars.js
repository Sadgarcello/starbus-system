/**
 * Pull stars toward centre on narrow phones so fringe lights stay reachable.
 * Matches camera focus + constellation segments (scaled X/Y, Z unchanged).
 */
export function layoutScaleForViewportWidth(w) {
  if (!w || w <= 0) return 1
  if (w < 340) return 0.52
  if (w < 380) return 0.58
  if (w < 440) return 0.66
  if (w < 520) return 0.74
  if (w < 640) return 0.82
  if (w < 900) return 0.92
  return 1
}

/** Screen-space-ish hit sizing for spheres (applied to radius). */
export function tapScaleForViewportWidth(w) {
  if (!w || w <= 0) return 1
  if (w < 360) return 3.2
  if (w < 420) return 2.95
  if (w < 520) return 2.65
  if (w < 640) return 2.2
  if (w < 900) return 1.45
  return 1
}

/**
 * Larger invisible picker radius multiplier so fat-finger taps register.
 */
export function hitPickerRadiusMultiplier(w) {
  if (!w || w <= 0) return 6
  if (w < 420) return 14
  if (w < 640) return 11
  if (w < 900) return 7
  return 5
}
