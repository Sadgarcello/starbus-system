import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Howl } from 'howler'
import { useExperience } from '../context/ExperienceContext'
import { startProceduralPiano } from '../lib/proceduralPiano'
import { publicAsset } from '../lib/publicAsset'
import SlideshowYoutubeAudio from './SlideshowYoutubeAudio'

export default function MemoryCollabSlideshow({
  slides,
  intervalMs = 5600,
  pianoSrc = '/audio/piano.mp3',
  youtubeAudioId,
  youtubeAudioStartSec = 0,
  audioCredit,
  caption,
}) {
  const [index, setIndex] = useState(0)
  const { muted } = useExperience()

  useEffect(() => {
    if (!slides?.length) return
    const t = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      intervalMs,
    )
    return () => clearInterval(t)
  }, [slides, intervalMs])

  useEffect(() => {
    if (!slides?.length || muted) return
    if (youtubeAudioId) return

    let proceduralStop = null
    let howl = null

    const end = () => {
      if (howl) {
        howl.unload()
        howl = null
      }
      if (proceduralStop) {
        proceduralStop()
        proceduralStop = null
      }
    }

    if (!pianoSrc) {
      proceduralStop = startProceduralPiano({ volume: 0.06 })
      return end
    }

    howl = new Howl({
      src: [publicAsset(pianoSrc)],
      loop: true,
      volume: 0.12,
      html5: true,
      preload: true,
      onload() {
        howl.play()
      },
      onloaderror() {
        if (!proceduralStop) proceduralStop = startProceduralPiano({ volume: 0.06 })
      },
    })

    return end
  }, [slides, pianoSrc, muted, youtubeAudioId])

  if (!slides?.length) return null

  const src = slides[index]

  return (
    <div className="mt-6 space-y-3">
      {youtubeAudioId ? (
        <SlideshowYoutubeAudio
          videoId={youtubeAudioId}
          loopStartSec={youtubeAudioStartSec}
          muted={muted}
        />
      ) : null}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-white/[0.1] bg-black shadow-[0_20px_60px_-24px_rgba(0,0,0,0.9)]"
        style={{ maxHeight: 'min(70dvh, 640px)' }}
      >
        <div
          className="flex min-h-[220px] w-full items-center justify-center p-3 md:p-4"
          style={{ maxHeight: 'min(68dvh, 620px)' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${src}-${index}`}
              className="flex max-h-full max-w-full items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={src}
                alt=""
                className="max-h-[min(62dvh,580px)] w-full max-w-full object-contain"
                decoding="async"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-black/75 via-transparent to-black/20" />

        {caption ? (
          <p className="font-body absolute bottom-0 left-0 right-0 z-20 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16 text-center text-[15px] leading-relaxed text-zinc-100/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] sm:px-5 sm:pb-5 md:text-base">
            {caption}
          </p>
        ) : null}
      </div>

      <div className="h-px w-full overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          key={index}
          className="h-full bg-gradient-to-r from-[#b89b5e]/40 via-white/35 to-[#6d8cae]/35"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: intervalMs / 1000, ease: 'linear' }}
        />
      </div>

      {audioCredit ? (
        <p className="text-center text-[9px] leading-relaxed text-zinc-600">{audioCredit}</p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index
                ? 'w-6 bg-white/70'
                : 'w-1.5 bg-white/20 hover:bg-white/35'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
