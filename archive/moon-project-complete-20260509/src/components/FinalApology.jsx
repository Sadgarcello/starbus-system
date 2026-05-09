import { motion, AnimatePresence } from 'framer-motion'
import { useExperience } from '../context/ExperienceContext'

const MESSAGE_HREF = 'mailto:you@example.com'

const lines = [
  'I know apologies do not undo damage.',
  'But I needed you to know that losing you was never something I took lightly.',
  'If this is the end, thank you for every moment that made me softer, wiser, and more human.',
  'And if it isn’t… I’ll do better this time.',
]

export default function FinalApology() {
  const { finalApologyOpen, setFinalApologyOpen } = useExperience()

  return (
    <AnimatePresence>
      {finalApologyOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto overscroll-y-contain bg-[radial-gradient(ellipse_at_center,_rgba(5,10,26,0.92)_0%,_rgba(2,4,18,0.97)_70%)] px-[max(1.5rem,env(safe-area-inset-left))] py-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10 pr-[max(1.5rem,env(safe-area-inset-right))] backdrop-blur-xl sm:py-14"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="max-w-xl text-center">
            {lines.map((line, i) => (
              <motion.p
                key={line}
                className="font-display mx-auto mb-8 text-xl font-normal leading-snug text-zinc-100/92 md:text-2xl md:leading-snug"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.85,
                  delay: 0.35 + i * 0.9,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {line}
              </motion.p>
            ))}
          </div>

          <motion.div
            className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: lines.length * 0.9 + 0.85, duration: 0.6 }}
          >
            <button
              type="button"
              className="font-body min-h-[44px] min-w-[10rem] rounded-full border border-white/[0.1] px-8 py-2.5 text-[13px] font-medium uppercase tracking-[0.2em] text-zinc-200 transition active:bg-white/[0.04] hover:border-white/20 hover:text-white"
              onClick={() => setFinalApologyOpen(false)}
            >
              Close The Sky
            </button>
            <a
              href={MESSAGE_HREF}
              className="font-body inline-flex min-h-[44px] min-w-[10rem] items-center justify-center rounded-full border border-[#b89b5e]/35 bg-[#b89b5e]/[0.08] px-8 py-2.5 text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-[#e9dcc0] shadow-[0_0_42px_-16px_rgb(184_155_94_/_0.55)] transition active:bg-[#b89b5e]/12 hover:border-[#b89b5e]/55 hover:bg-[#b89b5e]/14"
            >
              Message Me
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
