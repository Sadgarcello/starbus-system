import { useCallback, useEffect, useRef, useState } from 'react';

export type MicLevelLabel = 'idle' | 'too_quiet' | 'good' | 'too_loud';

const BAR_COUNT = 24;

function rmsFromAnalyser(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

function levelLabel(rms: number): MicLevelLabel {
  if (rms < 0.02) return 'too_quiet';
  if (rms > 0.18) return 'too_loud';
  return 'good';
}

function barsFromRms(rms: number): number {
  const normalized = Math.min(1, rms / 0.22);
  return Math.max(0, Math.min(BAR_COUNT, Math.round(normalized * BAR_COUNT)));
}

export function useMicLevelMeter() {
  const [active, setActive] = useState(false);
  const [bars, setBars] = useState(0);
  const [label, setLabel] = useState<MicLevelLabel>('idle');
  const [error, setError] = useState<string | null>(null);
  const [goodMs, setGoodMs] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const goodMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTickRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setActive(false);
    setBars(0);
    setLabel('idle');
  }, [stopLoop]);

  const start = useCallback(async () => {
    setError(null);
    goodMsRef.current = 0;
    setGoodMs(0);
    stop();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      setActive(true);

      const tick = (now: number) => {
        const rms = rmsFromAnalyser(analyser);
        setBars(barsFromRms(rms));
        const nextLabel = levelLabel(rms);
        setLabel(nextLabel);

        if (lastTickRef.current != null && nextLabel === 'good') {
          const delta = now - lastTickRef.current;
          goodMsRef.current += delta;
          setGoodMs(goodMsRef.current);
        }
        lastTickRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError('Microphone access was denied. Allow the mic in your browser settings and try again.');
      stop();
    }
  }, [stop, stopLoop]);

  useEffect(() => () => stop(), [stop]);

  const micPassed = goodMs >= 2500;

  return {
    active,
    bars,
    barCount: BAR_COUNT,
    label,
    error,
    goodMs,
    micPassed,
    start,
    stop,
  };
}

export const MIC_SAMPLE_PARAGRAPH =
  'There are several reasons why I would prefer to live in a large city. Some of the greatest advantages would include the number of job opportunities and career options, public transportation, greater diversity, and a wealth of entertainment. Also, large cities typically have a great deal to offer in terms of history, art and culture.';
