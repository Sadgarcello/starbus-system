import { useEffect, useRef } from 'react';
import { studentService } from '@/services/studentService';

const FLUSH_INTERVAL_MS = 60_000;
const TICK_MS = 1_000;

/** Records active time while the student has the app open and the tab is visible. */
export function useAppTimeTracker(
  studentId: string | undefined,
  enabled: boolean,
  onSynced?: () => void,
) {
  const pendingSeconds = useRef(0);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !studentId) return;

    function tick(now: number) {
      if (document.visibilityState !== 'visible') {
        lastTick.current = null;
        return;
      }
      if (lastTick.current != null) {
        const elapsed = Math.floor((now - lastTick.current) / 1000);
        if (elapsed > 0 && elapsed <= 5) {
          pendingSeconds.current += elapsed;
        }
      }
      lastTick.current = now;
    }

    const tickTimer = window.setInterval(() => tick(Date.now()), TICK_MS);

    const flushTimer = window.setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void flush();
        lastTick.current = null;
      } else {
        lastTick.current = Date.now();
      }
    }

    function onPageHide() {
      void flush();
    }

    lastTick.current = Date.now();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    async function flush() {
      const seconds = pendingSeconds.current;
      if (seconds < 1) return;
      pendingSeconds.current = 0;
      try {
        await studentService.recordAppTime(seconds);
        onSynced?.();
      } catch {
        pendingSeconds.current += seconds;
      }
    }

    return () => {
      window.clearInterval(tickTimer);
      window.clearInterval(flushTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [enabled, studentId, onSynced]);
}
