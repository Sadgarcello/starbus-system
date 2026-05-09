import { motion, AnimatePresence } from 'framer-motion'
import { memories } from '../data/memories'
import AudioController from '../components/AudioController'
import IntroScreen from '../components/IntroScreen'
import MoonScene from '../components/MoonScene'
import MemoryModal from '../components/MemoryModal'
import FinalApology from '../components/FinalApology'
import { useExperience } from '../context/ExperienceContext'
import { useLenis } from '../hooks/useLenis'

function clampTip(x, y, pad = 16) {
  if (typeof window === 'undefined') return { x: x, y: y }
  return {
    x: Math.min(Math.max(x, pad), window.innerWidth - pad),
    y: Math.min(Math.max(y, pad), window.innerHeight - pad),
  }
}

export default function Home() {
  const {
    entered,
    muted,
    setMuted,
    hoverLabel,
    secretOpen,
    setSecretOpen,
    regularOpenedCount,
    finalUnlocked,
    STARS_TO_UNLOCK_FINAL,
  } = useExperience()

  useLenis(entered)

  return (
    <div className="relative isolate min-h-[100dvh] min-h-[100svh] overflow-x-hidden bg-[#020412]">
      <AudioController />
      <IntroScreen />

      {entered && (
        <>
          <MoonScene memories={memories} />

          <div className="pointer-events-none fixed inset-x-0 top-0 z-[15] px-[max(0.875rem,env(safe-area-inset-left))] pr-[max(0.875rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] md:px-12 md:pr-12">
            <header className="flex max-[480px]:flex-row max-[480px]:items-start max-[480px]:justify-between max-[480px]:gap-3 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 max-w-[min(100%,20rem)] shrink pr-14 sm:max-w-md sm:pr-2 md:max-w-lg">
                <p className="font-display text-balance text-[1.125rem] font-normal leading-snug tracking-tight text-white/92 min-[390px]:text-xl sm:text-2xl md:text-4xl md:leading-snug">
                  Every light here is something I still remember.
                </p>
                <p className="mt-2 font-body text-[10px] uppercase tracking-[0.32em] text-zinc-500 min-[390px]:text-xs md:mt-3 md:text-[11px]">
                  Tap the stars.
                </p>
              </div>

              <div className="pointer-events-auto fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.65rem,env(safe-area-inset-top))] z-[18] flex flex-shrink-0 items-center gap-4 sm:relative sm:right-auto sm:top-auto sm:justify-end">
                <button
                  type="button"
                  aria-pressed={muted}
                  aria-label={muted ? 'Unmute ambient audio' : 'Mute ambient audio'}
                  onClick={() => setMuted((v) => !v)}
                  className="min-h-[40px] min-w-[110px] rounded-full border border-white/[0.09] bg-black/40 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-zinc-300 backdrop-blur-sm transition active:bg-white/[0.08] hover:border-white/15 hover:text-zinc-100 sm:relative sm:right-auto sm:top-auto sm:min-h-[44px] sm:min-w-0 sm:bg-white/[0.03] sm:px-4 sm:py-2.5 sm:text-[10px] sm:tracking-[0.26em]"
                >
                  {muted ? 'Sound off' : 'Sound on'}
                </button>
              </div>
            </header>
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[15] px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] md:px-12 md:pr-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              {!finalUnlocked && (
                <p className="max-w-[16rem] text-[11px] leading-relaxed text-zinc-500">
                  {regularOpenedCount} of {STARS_TO_UNLOCK_FINAL} lights revealed — a distant star awaits.
                </p>
              )}
              {finalUnlocked && (
                <p className="max-w-[18rem] text-[11px] leading-relaxed text-zinc-500">
                  Lines join only between memories that have spoken.
                </p>
              )}
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {hoverLabel && (
              <motion.div
                key={hoverLabel.text}
                className="pointer-events-none fixed z-30 rounded-full border border-white/[0.08] bg-black/35 px-3 py-1.5 font-body text-[10px] font-medium uppercase tracking-[0.38em] text-zinc-200/90 backdrop-blur-md"
                style={(() => {
                  const tip = clampTip(hoverLabel.x + 14, hoverLabel.y + 14)
                  return {
                    left: tip.x,
                    top: tip.y,
                    transform: 'translate(-50%, -100%)',
                  }
                })()}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {hoverLabel.text}
              </motion.div>
            )}
          </AnimatePresence>

          <MemoryModal />
          <FinalApology />

          <AnimatePresence>
            {secretOpen && (
              <motion.div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-[max(1rem,env(safe-area-inset-left))] py-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSecretOpen(false)}
              >
                <motion.div
                  className="pointer-events-auto max-w-sm rounded-[1.125rem] border border-white/[0.1] bg-white/[0.06] px-8 py-7 shadow-[0_24px_64px_-28px_rgb(0_0_0_/_0.8)] backdrop-blur-lg"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.985, y: 6 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-display text-center text-xl italic leading-snug text-zinc-50 md:text-2xl">
                    You were my favorite part of reality.
                  </p>
                  <button
                    type="button"
                    className="font-body mx-auto mt-6 block min-h-[44px] min-w-[120px] rounded-full border border-white/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400 transition active:bg-white/[0.06] hover:border-white/20 hover:text-zinc-100"
                    onClick={() => setSecretOpen(false)}
                  >
                    Return
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
