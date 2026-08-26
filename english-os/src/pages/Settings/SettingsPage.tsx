import { useRef, useState } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { NotificationTestPanel } from '@/components/notifications/NotificationTestPanel';
import { PushEnableBanner } from '@/components/notifications/PushEnableBanner';
import { InterestsEditor } from '@/components/student/InterestsEditor';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { avatarService } from '@/services/avatarService';

export default function SettingsPage() {
  const { profile, student, refresh, isAdmin } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || !profile) return;
    setUploading(true);
    setError(null);
    setOk(false);
    try {
      await avatarService.uploadAvatar(profile.id, file);
      await refresh();
      setOk(true);
    } catch (e) {
      setError((e as Error).message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Settings</h1>

      <PushEnableBanner />

      {isAdmin && <NotificationTestPanel />}

      <Card>
        <CardHeader title="Profile photo" subtitle="Shown on your student profile" />
        <div className="flex flex-wrap items-center gap-4 px-4 py-4">
          <Avatar
            path={profile?.avatar}
            name={profile?.name}
            email={profile?.email}
            size="lg"
          />
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {profile?.avatar ? 'Change photo' : 'Upload photo'}
            </Button>
            <p className="text-xs text-ink-subtle">JPEG/PNG · compressed automatically</p>
            {ok && <p className="text-xs font-semibold text-ink">Photo updated.</p>}
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        </div>
      </Card>

      {student && <InterestsEditor studentId={student.id} />}

      <Card>
        <CardHeader title="Account" />
        <div className="divide-y divide-paper-line text-sm">
          <Row label="Name" value={profile?.name || '—'} />
          <Row label="Email" value={profile?.email || '—'} />
          <Row label="Role" value={profile?.role || '—'} />
          <Row label="Status" value={profile?.status || '—'} />
          {student && (
            <>
              <Row label="Level" value={student.level} />
              <Row label="XP" value={String(student.xp)} />
              <Row label="Streak" value={String(student.streak)} />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <span className="text-ink-subtle">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
