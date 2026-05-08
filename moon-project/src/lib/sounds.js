/** Short, soft UI chime via Web Audio API (no asset file). */
let audioCtx

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

export function playMemoryChime(volume = 0.04) {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = 523.25
  g.gain.value = volume
  o.connect(g)
  g.connect(ctx.destination)

  const now = ctx.currentTime
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  o.start(now)
  o.stop(now + 0.5)
}
