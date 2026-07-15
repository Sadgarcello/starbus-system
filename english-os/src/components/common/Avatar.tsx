import { useEffect, useState } from 'react';
import { avatarService } from '@/services/avatarService';
import { cn } from '@/utils/cn';

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  path?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-14 w-14 text-sm',
  lg: 'h-20 w-20 text-xl sm:h-24 sm:w-24 sm:text-2xl',
  xl: 'h-24 w-24 text-2xl sm:h-28 sm:w-28 sm:text-3xl',
};

export function Avatar({ path, name, email, size = 'md', className }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    void avatarService.getSignedUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink bg-club font-bold text-ink',
        sizes[size],
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name || email || 'Avatar'} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(name, email)}</span>
      )}
    </div>
  );
}
