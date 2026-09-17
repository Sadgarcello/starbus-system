import type { ReactNode } from 'react';
import {
  parseDailyLifeContent,
  presentationForContentType,
  presentationLabel,
  type DailyLifePresentation,
} from '@/lib/readingPractice/dailyLifePresentation';

interface DailyLifeContentPanelProps {
  title?: string;
  content?: string;
  contentType?: string;
}

function ContentBody({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length <= 1) {
    return (
      <div className="whitespace-pre-wrap text-[15px] leading-[1.75] text-ink sm:text-base">
        {text}
      </div>
    );
  }
  return (
    <div className="space-y-4 text-[15px] leading-[1.75] text-ink sm:text-base">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </div>
  );
}

function EmailChrome({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-paper-line bg-paper">
      <div className="flex items-center justify-between border-b border-paper-line bg-paper-soft/80 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Email</span>
      </div>
      {children}
    </div>
  );
}

function DocumentHeader({
  title,
  presentation,
}: {
  title: string;
  presentation: DailyLifePresentation;
}) {
  return (
    <div className="border-b border-paper-line bg-paper-soft/50 px-5 py-4 sm:px-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
        {presentationLabel(presentation)}
      </p>
      <h2 className="mt-1 font-display text-xl leading-snug text-ink sm:text-2xl">{title}</h2>
    </div>
  );
}

export function DailyLifeContentPanel({ title, content, contentType }: DailyLifeContentPanelProps) {
  const bodyText = content?.trim() ?? '';
  const displayTitle = title?.trim() || 'Daily Life Reading';
  const presentation = presentationForContentType(contentType);
  const parsed = parseDailyLifeContent(bodyText);
  const subjectHeader = parsed.headers.find((h) => h.label.toLowerCase() === 'subject');
  const displaySubject = subjectHeader?.value ?? displayTitle;

  if (presentation === 'email') {
    const metaHeaders = parsed.headers.filter((h) => h.label.toLowerCase() !== 'subject');
    return (
      <EmailChrome>
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="font-display text-xl leading-snug text-ink sm:text-2xl">{displaySubject}</h2>
          {metaHeaders.length > 0 && (
            <dl className="mt-4 space-y-1.5 text-sm text-ink-muted">
              {metaHeaders.map((h) => (
                <div key={h.label} className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-ink">{h.label}:</dt>
                  <dd>{h.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {!subjectHeader && displayTitle !== displaySubject && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {displayTitle}
            </p>
          )}
          <div className="my-5 border-t border-paper-line" />
          <ContentBody text={parsed.body} />
        </div>
      </EmailChrome>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-paper-line bg-paper shadow-sm">
      <DocumentHeader title={displayTitle} presentation={presentation} />
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {parsed.headers.length > 0 && (
          <dl className="mb-5 space-y-1.5 rounded-md border border-paper-line bg-paper-soft/60 px-4 py-3 text-sm text-ink-muted">
            {parsed.headers.map((h) => (
              <div key={h.label} className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-ink">{h.label}:</dt>
                <dd>{h.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <ContentBody text={parsed.body} />
      </div>
    </div>
  );
}
