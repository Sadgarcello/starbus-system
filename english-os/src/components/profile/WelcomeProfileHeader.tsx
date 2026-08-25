import { Avatar } from '@/components/common/Avatar';

export function profileDisplayName(name?: string | null, email?: string | null) {
  if (name?.trim()) return name.trim();
  if (email) return email.split('@')[0];
  return 'there';
}

export function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

type WelcomeProfileHeaderProps = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  subtitle: string;
  compact?: boolean;
};

export function WelcomeProfileHeader({
  name,
  email,
  avatar,
  subtitle,
  compact = false,
}: WelcomeProfileHeaderProps) {
  const display = profileDisplayName(name, email);

  return (
    <div className={compact ? 'space-y-3 text-center' : 'flex flex-col items-center space-y-4 text-center'}>
      <Avatar
        path={avatar}
        name={name}
        email={email}
        size={compact ? 'lg' : 'xl'}
        className={compact ? 'mx-auto ring-2 ring-club/30' : 'ring-4 ring-club/40'}
      />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-subtle">
          {timeGreeting()}
        </p>
        <h1 className={compact ? 'mt-1 font-display text-2xl text-ink' : 'mt-2 font-display text-3xl text-ink sm:text-4xl'}>
          Welcome, {display}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}
