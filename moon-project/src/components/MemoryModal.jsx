import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { playMemoryChime } from '../lib/sounds'
import { useExperience } from '../context/ExperienceContext'
import MemoryCollabSlideshow from './MemoryCollabSlideshow'
import ElusiveTrapButton from './ElusiveTrapButton'

function youtubeEmbedSrc(videoId, startSeconds) {
  const q = new URLSearchParams({
    autoplay: '1',
    loop: '1',
    playlist: videoId,
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
  })
  if (typeof startSeconds === 'number' && startSeconds > 0) {
    q.set('start', String(Math.floor(startSeconds)))
  }
  return `https://www.youtube.com/embed/${videoId}?${q}`
}

export default function MemoryModal() {
  const { activeMemory, closeMemory, muted } = useExperience()
  const ytId = activeMemory?.youtubeId
  const hasYoutube = Boolean(ytId)
  const hasSlides = Boolean(activeMemory?.slideImages?.length)
  const hasTrap = Boolean(activeMemory?.trapButtonLabel)

  useEffect(() => {
    if (!activeMemory || muted || hasYoutube || hasSlides || hasTrap) return
    playMemoryChime(0.035)
  }, [activeMemory, muted, hasYoutube, hasSlides, hasTrap])

  return (
    <AnimatePresence>
      {activeMemory && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto overscroll-y-contain bg-black/45 px-[max(1rem,env(safe-area-inset-left))] py-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-md sm:py-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onClick={closeMemory}
        >
          <motion.article
            role="dialog"
            aria-modal="true"
            className={`pointer-events-auto relative max-h-[min(92dvh,920px)] w-full overflow-y-auto overscroll-y-contain rounded-[1.25rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)] sm:p-8 ${hasYoutube || hasSlides ? 'max-w-3xl' : 'max-w-lg'}`}
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-zinc-500">
                {activeMemory.label}
              </span>
              <button
                type="button"
                onClick={closeMemory}
                className="min-h-[44px] shrink-0 rounded-full border border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400 transition active:bg-white/[0.06] hover:border-white/20 hover:text-zinc-200 sm:py-2.5"
              >
                Close
              </button>
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-zinc-50 md:text-4xl">
              {activeMemory.title}
            </h2>
            {hasSlides && activeMemory.slideImages?.length ? (
              <MemoryCollabSlideshow
                key={activeMemory.id}
                slides={activeMemory.slideImages}
                intervalMs={(activeMemory.slideDurationSec ?? 5.6) * 1000}
                pianoSrc={activeMemory.pianoAudio}
                youtubeAudioId={activeMemory.slideAudioYoutubeId}
                youtubeAudioStartSec={activeMemory.slideAudioYoutubeStartSec ?? 0}
                audioCredit={activeMemory.pianoCredit}
                caption={activeMemory.text}
              />
            ) : null}
            {!hasSlides && !hasYoutube && hasTrap ? (
              <ElusiveTrapButton
                key={activeMemory.id}
                label={activeMemory.trapButtonLabel}
              />
            ) : null}
            {hasYoutube && ytId && (
              <div className="mt-6 aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black shadow-inner">
                <iframe
                  key={`${ytId}-${activeMemory.youtubeStart ?? 0}`}
                  title={`YouTube ${activeMemory.title}`}
                  className="h-full w-full min-h-[220px]"
                  src={youtubeEmbedSrc(ytId, activeMemory.youtubeStart)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            )}
            {activeMemory.text &&
            !hasSlides &&
            !hasYoutube &&
            !hasTrap ? (
              <p className="mt-5 text-base leading-relaxed text-zinc-300/95 md:text-lg">
                {activeMemory.text}
              </p>
            ) : null}
            {!hasYoutube && !hasSlides && !hasTrap && activeMemory.image && (
              <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.06]">
                <img
                  src={activeMemory.image}
                  alt=""
                  className="max-h-64 w-full object-cover opacity-90"
                />
              </div>
            )}
            {!hasYoutube && !hasSlides && !hasTrap && activeMemory.audio && (
              <audio className="mt-6 w-full opacity-80" controls src={activeMemory.audio} />
            )}
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
