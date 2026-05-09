import { useEffect, useRef } from 'react'
import { publicAsset } from '../lib/publicAsset'
import { Howl } from 'howler'
import { useExperience } from '../context/ExperienceContext'

export default function AudioController() {
  const { entered, muted, finalApologyOpen } = useExperience()
  const ambientRef = useRef(null)

  useEffect(() => {
    const h = new Howl({
      src: [publicAsset('/audio/ambient.mp3')],
      loop: true,
      volume: 0.12,
      html5: true,
      preload: true,
      onloaderror: () => {},
    })
    ambientRef.current = h
    return () => {
      h.unload()
      ambientRef.current = null
    }
  }, [])

  useEffect(() => {
    const h = ambientRef.current
    if (!h) return
    if (!entered) {
      h.stop()
      return
    }
    h.mute(muted)
    if (h.state() === 'loaded') {
      const base = 0.12
      if (!muted) h.volume(finalApologyOpen ? base * 0.45 : base)
    }
    if (!muted && h.state() === 'loaded' && !h.playing()) h.play()
  }, [entered, muted, finalApologyOpen])

  return null
}
