import type { ActivityType } from '@/types';
import type { ExamTrack } from '@/lib/examTrackContent';
import { getExamTrackLabel, getSkillTrackStyle } from '@/lib/examTrackContent';
import { ExamTrackBadge } from '@/components/exam/ExamTrackBadge';
import { cn } from '@/utils/cn';

interface SkillModuleHeaderProps {
  skill: ActivityType;
  title: string;
  examTrack?: ExamTrack | null;
  isTeacher?: boolean;
}

export function SkillModuleHeader({
  skill,
  title,
  examTrack,
  isTeacher = false,
}: SkillModuleHeaderProps) {
  const style = getSkillTrackStyle(skill, examTrack, isTeacher);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-subtle">Skill module</p>
          {examTrack && !isTeacher && <ExamTrackBadge track={examTrack} />}
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="mt-1 text-sm font-medium text-ink-muted">{style.subtitle}</p>
        <p className="mt-1 text-sm text-ink-subtle">{style.description}</p>
      </div>

      {!isTeacher && examTrack && style.focusPoints.length > 0 && (
        <div className={cn('rounded-md border px-4 py-3', style.accentClass)}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">
            {getExamTrackLabel(examTrack)} focus
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted">
            {style.focusPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {!isTeacher && !examTrack && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Pick your exam track on <strong>Profile</strong> or <strong>Settings</strong> (TOEFL, IELTS,
          or Linguaskill) to unlock tailored practice for this skill.
        </p>
      )}
    </div>
  );
}
