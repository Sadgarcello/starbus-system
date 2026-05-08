/**
 * Very soft, sparse “piano-ish” ambience when no MP3 is available.
 * Returns a cleanup function.
 */
export function startProceduralPiano({ volume = 0.055 } = {}) {
  if (typeof window === 'undefined') return () => {}

  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return () => {}

  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)

  const scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0]
  let step = 0
  let stopped = false

  function pluck(freq, t0) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1)
    osc.connect(g)
    g.connect(master)
    osc.start(t0)
    osc.stop(t0 + 1.15)
  }

  function tick() {
    if (stopped) return
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime + 0.05
    const i = step % scale.length
    pluck(scale[i], t)
    if (step % 3 === 0) pluck(scale[(i + 2) % scale.length], t + 0.18)
    step += 1
  }

  tick()
  const id = window.setInterval(tick, 2800)

  return () => {
    stopped = true
    window.clearInterval(id)
    master.disconnect()
    ctx.close().catch(() => {})
  }
}
