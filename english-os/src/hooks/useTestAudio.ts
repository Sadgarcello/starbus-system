import { useCallback, useRef, useState } from 'react';

/** Play a short test tone via Web Audio (no asset file required). */
export function useTestAudio() {
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback(async () => {
    if (playing) return;
    setPlaying(true);
    try {
      const ctx = ctxRef.current ?? new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      const tones = [440, 554, 659];
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.45 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.45 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.45);
        osc.stop(now + i * 0.45 + 0.45);
      });

      await new Promise((r) => setTimeout(r, 1600));
      setPlayed(true);
    } finally {
      setPlaying(false);
    }
  }, [playing]);

  return { play, playing, played, resetPlayed: () => setPlayed(false) };
}
