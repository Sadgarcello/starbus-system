export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-subtle">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-paper-line border-t-club" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
