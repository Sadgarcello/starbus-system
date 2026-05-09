import { useEffect, useRef } from 'react'
import { ensureYoutubeIframeApi } from '../lib/youtubeIframeApi'

function applyMutePlayback(player, muted, loopStartSec) {
  if (!player || typeof player.playVideo !== 'function') return
  if (muted) {
    player.mute?.()
    player.pauseVideo?.()
    return
  }
  player.unMute?.()
  if (loopStartSec > 0 && typeof player.seekTo === 'function') {
    player.seekTo(loopStartSec, true)
  }
  player.playVideo?.()
}

/**
 * Visually hidden YouTube embed for slideshow underscore audio.
 * Re-seeks on ENDED so the loop repeats from loopStartSec (embed `loop` alone restarts from 0:00).
 */
export default function SlideshowYoutubeAudio({ videoId, loopStartSec = 0, muted }) {
  const mountRef = useRef(null)
  const playerRef = useRef(null)
  const createdRef = useRef(null)
  const mutedRef = useRef(muted)
  const loopStartRef = useRef(loopStartSec)

  useEffect(() => {
    mutedRef.current = muted
    loopStartRef.current = loopStartSec
  }, [muted, loopStartSec])

  useEffect(() => {
    const el = mountRef.current
    if (!videoId || !el) return

    let destroyed = false

    ;(async () => {
      try {
        await ensureYoutubeIframeApi()
      } catch {
        return
      }
      if (destroyed || !mountRef.current) return

      const start = Math.floor(loopStartSec)

      const ytPlayer = new window.YT.Player(mountRef.current, {
        videoId,
        height: '200',
        width: '356',
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: mutedRef.current ? 0 : 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          ...(start > 0 ? { start } : {}),
        },
        events: {
          onReady: (e) => {
            if (destroyed) return
            playerRef.current = e.target
            applyMutePlayback(e.target, mutedRef.current, loopStartRef.current)
          },
          onStateChange: (e) => {
            const YT = window.YT
            if (!YT || !e?.target || destroyed) return
            if (e.data !== YT.PlayerState.ENDED) return
            const p = e.target
            const t = loopStartRef.current
            if (typeof p.seekTo === 'function') p.seekTo(t, true)
            if (!mutedRef.current) {
              p.unMute?.()
              p.playVideo?.()
            } else {
              p.pauseVideo?.()
            }
          },
        },
      })
      createdRef.current = ytPlayer
    })()

    return () => {
      destroyed = true
      playerRef.current = null
      try {
        createdRef.current?.destroy?.()
      } catch {
        // ignore destroy races
      }
      createdRef.current = null
    }
  }, [videoId, loopStartSec])

  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    applyMutePlayback(p, muted, loopStartSec)
  }, [muted, loopStartSec])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed -left-[600px] top-0 isolate z-[1] h-[200px] w-[364px] overflow-hidden opacity-[0.015]"
    >
      <div ref={mountRef} />
    </div>
  )
}
