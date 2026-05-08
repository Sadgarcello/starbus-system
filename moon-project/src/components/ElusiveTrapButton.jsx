import { useCallback, useRef, useState } from 'react'

const PAD = 10

export default function ElusiveTrapButton({ label }) {
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const rafRef = useRef(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const flee = useCallback((clientX, clientY, multiplier = 1) => {
    const wrap = wrapRef.current
    const btn = btnRef.current
    if (!wrap || !btn) return

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const wRect = wrap.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      const btnW = btnRect.width || 220
      const btnH = btnRect.height || 48

      const px = clientX - wRect.left
      const py = clientY - wRect.top

      setOffset((prev) => {
        const bx = wRect.width / 2 + prev.x
        const by = wRect.height / 2 + prev.y

        let dx = bx - px
        let dy = by - py
        const dist = Math.hypot(dx, dy) || 1
        const awaken = Math.min(wRect.width, wRect.height) * 0.22 + 72

        if (dist >= awaken) return prev

        dx /= dist
        dy /= dist

        const push =
          multiplier *
          (((awaken - dist) / awaken) *
            Math.min(wRect.width, wRect.height) *
            0.22 +
            42)

        let nx = prev.x + dx * push
        let ny = prev.y + dy * push

        const maxX = Math.max(0, wRect.width / 2 - btnW / 2 - PAD)
        const maxY = Math.max(0, wRect.height / 2 - btnH / 2 - PAD)

        nx = Math.max(-maxX, Math.min(maxX, nx))
        ny = Math.max(-maxY, Math.min(maxY, ny))

        return { x: nx, y: ny }
      })
    })
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative mt-8 h-[min(42dvh,360px)] w-full touch-manipulation select-none overflow-hidden rounded-xl border border-white/[0.1] bg-zinc-950/80 md:h-[340px]"
      onPointerMove={(e) => flee(e.clientX, e.clientY, 1)}
      onPointerDown={(e) => flee(e.clientX, e.clientY, 1.15)}
      role="presentation"
    >
      <p className="pointer-events-none absolute left-4 top-3 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-600">
        unreachable
      </p>
      <button
        ref={btnRef}
        type="button"
        className="pointer-events-auto absolute left-1/2 top-1/2 whitespace-nowrap rounded-full border border-[#b89b5e]/40 bg-gradient-to-br from-[#b89b5e]/20 to-transparent px-8 py-3.5 font-body text-sm font-semibold uppercase tracking-[0.22em] text-[#ecd9b8] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)] outline-none"
        style={{
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        }}
        tabIndex={-1}
        onPointerEnter={(e) => flee(e.clientX, e.clientY, 2.2)}
        aria-hidden="true"
      >
        {label}
      </button>
    </div>
  )
}
