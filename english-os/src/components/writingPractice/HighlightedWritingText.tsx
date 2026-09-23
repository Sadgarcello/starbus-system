import type { ReactNode } from 'react';
import type { WritingErrorItem } from '@/lib/writingPractice/types';

export function HighlightedWritingText({
  text,
  errors,
  activeIndex,
  onSelect,
}: {
  text: string;
  errors: WritingErrorItem[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}) {
  if (!text) return null;
  const sorted = [...errors]
    .filter((e) => e.end_offset > e.start_offset)
    .sort((a, b) => a.start_offset - b.start_offset);

  const parts: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((err, i) => {
    if (err.start_offset > cursor) {
      parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, err.start_offset)}</span>);
    }
    parts.push(
      <button
        key={`e-${i}`}
        type="button"
        onClick={() => onSelect(i)}
        className={`rounded px-0.5 font-semibold underline decoration-wavy ${
          activeIndex === i ? 'bg-danger/20 text-danger' : 'bg-danger/10 text-ink'
        }`}
      >
        {text.slice(err.start_offset, err.end_offset)}
      </button>,
    );
    cursor = err.end_offset;
  });
  if (cursor < text.length) parts.push(<span key={`end`}>{text.slice(cursor)}</span>);

  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{parts}</p>;
}
