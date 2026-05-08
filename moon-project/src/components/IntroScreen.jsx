import { motion, AnimatePresence } from 'framer-motion'
import { useExperience } from '../context/ExperienceContext'

const dust = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  s: 0.4 + Math.random() * 1.2,
  d: 12 + Math.random() * 20,
}))

export default function IntroScreen() {
  const { entered, setEntered } = useExperience()

  return (
    <AnimatePresence>
      {!entered && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-y-auto overscroll-y-contain bg-[#020412] px-[max(1.5rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1.5rem,env(safe-area-inset-right))]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {dust.map((p) => (
              <motion.span
                key={p.id}
                className="absolute rounded-full bg-white/25"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.s,
                  height: p.s,
                }}
                animate={{ opacity: [0.15, 0.55, 0.2], y: [0, -8, 0] }}
                transition={{
                  duration: p.d,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: p.id * 0.08,
                }}
              />
            ))}
          </div>

          <motion.div
            className="relative mb-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#f3efe6] via-[#d9d4cc] to-[#8f8a82] blur-[1px]"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: [0, 1], scale: [0.94, 1] }}
            transition={{ duration: 3.8, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.p
            className="font-display text-center text-2xl font-normal tracking-wide text-zinc-200/90 md:text-3xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            Some things are easier shown than explained.
          </motion.p>

          <motion.div
            className="mt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.2, duration: 1 }}
          >
            <button
              type="button"
              onClick={() => setEntered(true)}
              className="group font-display relative min-h-[44px] px-14 py-3 text-lg tracking-[0.35em] text-zinc-100/95 transition-colors active:opacity-90 hover:text-white"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#c9a962]/25 via-transparent to-[#6d8cae]/22 opacity-60 blur-xl transition-opacity group-hover:opacity-95" />
              <span className="absolute inset-0 rounded-full border border-white/[0.09] shadow-[0_0_40px_-12px_rgb(184_155_94_/_0.45)] shadow-[rgba(225,227,237,0.03)_0_-1px_0_inset]" />
              <span className="relative">ENTER</span>
            </button>
          </motion.div>

          <p className="mt-8 max-w-xs text-center text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500">
            Even when things went dark, I still remembered every light.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
