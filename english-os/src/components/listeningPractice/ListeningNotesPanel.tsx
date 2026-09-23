import { useState } from 'react';

interface ListeningNotesPanelProps {
  disabled?: boolean;
}

export function ListeningNotesPanel({ disabled }: ListeningNotesPanelProps) {
  const [notes, setNotes] = useState('');

  return (
    <div className="rounded-lg border border-paper-line bg-paper-soft/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Notes</p>
      <p className="mt-0.5 text-xs text-ink-muted">For your use only — not scored.</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={disabled}
        rows={5}
        placeholder="Names, dates, ideas, examples…"
        className="mt-2 w-full resize-y rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink"
      />
    </div>
  );
}
