interface Speaker {
  name: string;
  role: string;
  imageUrl: string | null;
}

export function ListeningSpeakerStrip({ speakers }: { speakers: Speaker[] }) {
  if (speakers.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-paper-line bg-paper-soft/30 text-xs text-ink-muted">
        Speaker visual
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      {speakers.map((s) => (
        <div key={`${s.name}-${s.role}`} className="flex flex-col items-center gap-2 text-center">
          <div className="h-20 w-20 overflow-hidden rounded-full border border-paper-line bg-paper-soft">
            {s.imageUrl ? (
              <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-ink-subtle">
                {s.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-ink">{s.name}</p>
            <p className="text-[10px] text-ink-muted">{s.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
