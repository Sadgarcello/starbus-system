/**
 * Zoom out / widen FOV slightly on phones so constellation stays in-frustum.
 */
export function getViewportCameraTune(width, height) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const asp = w / h
  /** Extra-tall notch phones */
  if (asp < 0.46 || w < 360)
    return { homeZ: 18.85, focusZMin: 7.95, focusZMax: 15.2, homeFov: 55 }

  if (asp < 0.52 || w < 430)
    return { homeZ: 17.6, focusZMin: 7.6, focusZMax: 14.6, homeFov: 53 }

  if (asp < 0.56 || w < 520)
    return { homeZ: 16.45, focusZMin: 7.35, focusZMax: 13.6, homeFov: 50 }

  if (w < 640)
    return { homeZ: 15.65, focusZMin: 7.1, focusZMax: 12.95, homeFov: 48 }

  if (w < 960)
    return { homeZ: 14.9, focusZMin: 6.8, focusZMax: 12.2, homeFov: 46 }

  return {
    homeZ: 14,
    focusZMin: 6.5,
    focusZMax: 11.8,
    homeFov: 44,
  }
}
