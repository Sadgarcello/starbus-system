import { ToeflExamShell } from '@/layouts/ToeflExamShell';

export function ExamStepCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="font-display text-center text-2xl text-ink sm:text-3xl">{title}</h1>
      <hr className="border-paper-line" />
      <div className="space-y-5 text-sm leading-relaxed text-ink-muted sm:text-base">{children}</div>
    </div>
  );
}

export function ExamIconRow() {
  return (
    <div className="flex justify-center gap-6 py-4">
      {[
        { label: 'Microphone', icon: MicIcon },
        { label: 'Headset', icon: HeadsetIcon },
        { label: 'Volume', icon: SpeakerIcon },
      ].map(({ label, icon: Icon }) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-club/40 bg-club-soft text-ink">
            <Icon />
          </div>
          <span className="text-xs text-ink-subtle">{label}</span>
        </div>
      ))}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3a9 9 0 0 0-9 9v5a3 3 0 0 0 3 3h1v-7H5a7 7 0 0 1 14 0h-2v7h1a3 3 0 0 0 3-3v-5a9 9 0 0 0-9-9z" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.05a4.48 4.48 0 0 0 2.5-4.02zM14 3.23v2.06a7 7 0 0 1 0 13.54v2.06a9 9 0 0 0 0-17.59z" />
    </svg>
  );
}

export function ExamShell({ ...props }: React.ComponentProps<typeof ToeflExamShell>) {
  return <ToeflExamShell {...props} />;
}
