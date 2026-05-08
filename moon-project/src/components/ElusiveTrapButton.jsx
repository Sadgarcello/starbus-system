import { useCallback, useRef, useState } from 'react'

/** Inset label from arena borders so it can't be pinned flush in corners. */
function edgeMargin(rect) {
  return Math.min(34, rect.width * 0.07, rect.height * 0.07) + 10
}

export default function ElusiveTrapButton({ label }) {
  const wrapRef = useRef(null)
  const labelRef = useRef(null)
  const rafRef = useRef(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const flee = useCallback((clientX, clientY, multiplier = 1) => {
    const wrap = wrapRef.current
    const pill = labelRef.current
    if (!wrap || !pill) return

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const wRect = wrap.getBoundingClientRect()
      const pr = pill.getBoundingClientRect()
      const btnW = Math.max(pr.width, 140)
      const btnH = Math.max(pr.height, 40)

      const px = clientX - wRect.left
      const py = clientY - wRect.top
      const cw = wRect.width
      const ch = wRect.height
      const margin = edgeMargin(wRect)
      const maxX = Math.max(8, cw / 2 - btnW / 2 - margin)
      const maxY = Math.max(8, ch / 2 - btnH / 2 - margin)

      const box = (ox, oy) => {
        const bcx = cw / 2 + ox
        const bcy = ch / 2 + oy
        return {
          bcx,
          bcy,
          left: bcx - btnW / 2,
          right: bcx + btnW / 2,
          top: bcy - btnH / 2,
          bottom: bcy + btnH / 2,
        }
      }

      setOffset((prev) => {
        let nx = prev.x
        let ny = prev.y

        const clamp = () => {
          nx = Math.max(-maxX, Math.min(maxX, nx))
          ny = Math.max(-maxY, Math.min(maxY, ny))
        }

        const repelFromWalls = () => {
          let b = box(nx, ny)
          if (b.left < margin) nx += margin - b.left
          if (b.right > cw - margin) nx -= b.right - (cw - margin)
          if (b.top < margin) ny += margin - b.top
          if (b.bottom > ch - margin) ny -= b.bottom - (ch - margin)
          clamp()
        }

        const awake =
          Math.min(cw, ch) * Math.min(0.44, multiplier * 0.22 + 0.22) +
          Math.min(120, cw * 0.14)

        const distanceToCursor = () => {
          const b = box(nx, ny)
          const dx = b.bcx - px
          const dy = b.bcy - py
          return { dist: Math.hypot(dx, dy) || 1, dx, dy }
        }

        const pushAway = (factor) => {
          const { dist, dx, dy } = distanceToCursor()
          if (dist >= awake) return false
          const ux = dx / dist
          const uy = dy / dist
          const urgency = Math.max(0, (awake - dist) / awake)
          const spike =
            factor *
              (urgency * (Math.min(cw, ch) * 0.2 + btnW * 0.42) +
                58 + urgency * btnH * 0.25)
          nx += ux * spike
          ny += uy * spike
          clamp()
          repelFromWalls()
          return true
        }

        pushAway(multiplier)

        const dangerInner = awake * 0.4
        for (let i = 0; i < 8; i++) {
          const step = distanceToCursor()
          if (step.dist >= dangerInner) break
          const inv = step.dist || 1
          nx +=
            (step.dx / inv) * multiplier * (Math.min(maxX, maxY) * 0.36 + 64)
          clamp()
          repelFromWalls()
          if (distanceToCursor().dist >= dangerInner - 8) break
        }

        const near = distanceToCursor()
        if (near.dist < dangerInner * 1.05) {
          let tx = cw / 2 - px
          let ty = ch / 2 - py
          const tDist = Math.hypot(tx, ty) || 1
          tx /= tDist
          ty /= tDist
          nx = tx * maxX * 0.92
          ny = ty * maxY * 0.92
          clamp()
          repelFromWalls()
        }

        const slam = distanceToCursor()
        if (slam.dist < awake * 0.32 && maxX > 10 && maxY > 10) {
          const inv = slam.dist || 1
          nx += (slam.dx / inv) * maxX * 0.72 * multiplier
          ny += (slam.dy / inv) * maxY * 0.72 * multiplier
          clamp()
          repelFromWalls()
        }

        return { x: nx, y: ny }
      })
    })
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative mt-8 h-[min(42dvh,360px)] w-full cursor-default touch-none select-none overflow-hidden rounded-xl border border-white/[0.1] bg-zinc-950/80 md:h-[340px]"
      onPointerMove={(e) => flee(e.clientX, e.clientY, 1)}
      onPointerDown={(e) => flee(e.clientX, e.clientY, 1.4)}
      role="presentation"
    >
      <p className="pointer-events-none absolute left-4 top-3 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-600">
        unreachable
      </p>

      {/* Visual-only: pointer never rests on this node — avoids hover/corner lock */}
      <div
        ref={labelRef}
        className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap rounded-full border border-[#b89b5e]/40 bg-gradient-to-br from-[#b89b5e]/20 to-transparent px-8 py-3.5 font-body text-sm font-semibold uppercase tracking-[0.22em] text-[#ecd9b8] shadow-[0_8px_32px_-12px_rgba(0,0,0,0.7)]"
        aria-hidden="true"
        style={{
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        }}
      >
        {label}
      </div>

      {/* Accessible name only (not shown, not clickable) */}
      <span className="sr-only">{label}</span>
    </div>
  )
}
