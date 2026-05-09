import { useEffect } from 'react'
import Lenis from 'lenis'

/** Lenis fights iOS/Android scroll; use only on hover + fine-pointer desktops. */
function shouldSkipLenis() {
  if (typeof window === 'undefined') return true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  const desktopFine = window.matchMedia(
    '(hover: hover) and (pointer: fine)',
  ).matches
  return !desktopFine
}

export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled || shouldSkipLenis()) return

    const lenis = new Lenis({
      smoothWheel: true,
      lerp: 0.08,
    })

    let raf = 0
    function tick(t) {
      lenis.raf(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [enabled])
}
