import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface ListeningOnceAudioPlayerProps {
  src: string;
  assessmentMode?: boolean;
  onEnded: () => void;
  onPlayStart?: () => void;
}

/** Placement mode: single play, no seek, no replay. */
export function ListeningOnceAudioPlayer({
  src,
  assessmentMode = true,
  onEnded,
  onPlayStart,
}: ListeningOnceAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    setStarted(false);
    setPlaying(false);
    setEnded(false);
  }, [src]);

  function handlePlay() {
    const el = audioRef.current;
    if (!el || ended) return;
    if (assessmentMode && started) return;
    void el.play();
    setStarted(true);
    setPlaying(true);
    onPlayStart?.();
  }

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={() => {
          if (!assessmentMode || !audioRef.current) return;
          if (audioRef.current.currentTime < audioRef.current.duration - 0.05) return;
        }}
        onSeeking={(e) => {
          if (!assessmentMode) return;
          const el = e.currentTarget;
          if (el.currentTime > 0.05) {
            el.currentTime = 0;
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          onEnded();
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        className="sr-only"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handlePlay}
          disabled={assessmentMode ? started || ended : false}
        >
          {ended ? 'Audio finished' : playing ? 'Playing…' : started ? 'Playing…' : 'Play audio'}
        </Button>
        {assessmentMode && (
          <p className="text-xs text-ink-muted">
            {ended
              ? 'You heard this once. Continue to the questions.'
              : started
                ? 'Listen carefully — replay is not available in this test.'
                : 'Audio plays once. You may take notes while listening.'}
          </p>
        )}
      </div>
    </div>
  );
}
