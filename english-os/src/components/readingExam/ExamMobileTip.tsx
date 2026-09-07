import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { isMobileDevice } from '@/lib/deviceContext';

const DISMISS_KEY = 'khawaja-exam-mobile-tip-dismissed';

export function ExamMobileTip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobileDevice()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-club/40 bg-club-soft p-4 shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6"
      role="status"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-ink-subtle">Better on laptop</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">
        For the real exam feel, use a <strong>laptop with headphones</strong>. Phone works, but a
        larger screen and headset match how TOEFL is taken.
      </p>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" variant="primary" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
