import { useEffect, useState } from 'react';
import { readingService } from '@/services/readingService';
import { cn } from '@/utils/cn';

interface BookCoverProps {
  path?: string | null;
  title: string;
  className?: string;
}

export function BookCover({ path, title, className }: BookCoverProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    void readingService.getCoverUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div
      className={cn(
        'relative aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-lg border border-ink/20 bg-club-soft shadow-md sm:w-52 md:w-56',
        className,
      )}
    >
      {url ? (
        <img src={url} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center px-3 text-center">
          <span className="font-display text-base text-ink/70 sm:text-lg">{title.slice(0, 36)}</span>
        </div>
      )}
    </div>
  );
}
