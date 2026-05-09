import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ease = [0.22, 1, 0.36, 1]

export default function ImageCollage({
  images,
  intervalMs = 4800,
  reducedMotion,
}) {
  const [idx, setIdx] = useState(0)
  const list = images ?? []

  useEffect(() => {
    if (list.length < 2) return
    const t = window.setInterval(
      () => setIdx((i) => (i + 1) % list.length),
      intervalMs,
    )
    return () => clearInterval(t)
  }, [list.length, intervalMs])

  const direction = useMemo(() => (idx % 2 === 0 ? 1 : -1), [idx])

  if (!list.length) return null

  const src = list[idx]

  if (reducedMotion) {
    return (
      <div className="relative aspect-[3/4] max-h-[min(58vh,640px)] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black/40 shadow-inner md:aspect-video md:max-h-[min(50vh,520px)]">
        <img src={src} alt="" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.04]" />
      </div>
    )
  }

  return (
    <div className="relative aspect-[3/4] max-h-[min(58vh,640px)] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black/70 shadow-inner md:aspect-video md:max-h-[min(52vh,540px)]">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={src}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease }}
        >
          <motion.div
            className="relative h-full w-full"
            initial={{
              scale: 1.04,
              x: direction * (typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.02, 18) : 12),
              rotate: direction * -0.4,
              filter: 'blur(14px)',
            }}
            animate={{
              scale: 1.12,
              x: direction * -6,
              rotate: direction * 0.55,
              filter: 'blur(0px)',
            }}
            transition={{ duration: intervalMs / 1000 + 0.4, ease: 'linear' }}
          >
            <div className="pointer-events-none absolute inset-[-8%]">
              <img
                src={src}
                alt=""
                draggable={false}
                className="h-full w-full object-cover brightness-[1.03] saturate-[1.06]"
              />
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl"
        animate={{
          boxShadow:
            idx % 2 === 0
              ? ['inset 0 0 80px rgb(184 155 94 / 0.08)', 'inset 0 0 44px rgb(109 140 174 / 0.12)', 'inset 0 0 80px rgb(184 155 94 / 0.08)']
              : ['inset 0 0 60px rgb(109 140 174 / 0.1)', 'inset 0 0 100px rgb(184 155 94 / 0.07)', 'inset 0 0 60px rgb(109 140 174 / 0.1)'],
        }}
        transition={{ duration: intervalMs / 1000 + 1, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050816]/50 via-transparent to-[#050816]/30" />

      {/* Film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
