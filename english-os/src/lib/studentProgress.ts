import type {
  ActivityType,
  AssignmentWithActivity,
  AttendanceMark,
  AttendanceSession,
} from '@/types';

const SKILLS: ActivityType[] = ['speaking', 'reading', 'writing', 'listening'];

export type SkillKey = 'overall' | ActivityType;

export interface SkillCompletion {
  key: SkillKey;
  label: string;
  percent: number;
  done: number;
  total: number;
  xp: number;
}

export interface MonthlyProgressPoint {
  month: string;
  label: string;
  speaking: number;
  reading: number;
  writing: number;
  listening: number;
  overall: number;
}

export type ActivityFeedKind =
  | 'assigned'
  | 'submitted'
  | 'reviewed'
  | 'returned'
  | 'attendance';

export interface ActivityFeedItem {
  id: string;
  kind: ActivityFeedKind;
  title: string;
  detail: string;
  at: string;
  assignmentId?: string;
  skill?: ActivityType;
}

function isDone(status: string) {
  return status === 'submitted' || status === 'reviewed';
}

function completionFor(
  assignments: AssignmentWithActivity[],
  type?: ActivityType,
): { percent: number; done: number; total: number; xp: number } {
  const scoped = type ? assignments.filter((a) => a.activity?.type === type) : assignments;
  const total = scoped.length;
  const done = scoped.filter((a) => isDone(a.status)).length;
  const xp = scoped.reduce((sum, a) => sum + (a.review?.xp_awarded ?? 0), 0);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { percent, done, total, xp };
}

const LABELS: Record<SkillKey, string> = {
  overall: 'Overall Progress',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
};

export function computeSkillCompletions(
  assignments: AssignmentWithActivity[],
  options?: { speakingProgress?: number; readingProgress?: number },
): SkillCompletion[] {
  const overall = completionFor(assignments);
  return [
    { key: 'overall', label: LABELS.overall, ...overall },
    ...SKILLS.map((skill) => {
      if (skill === 'speaking' && options?.speakingProgress != null) {
        const percent = Math.max(0, Math.min(100, options.speakingProgress));
        return {
          key: skill as SkillKey,
          label: LABELS[skill],
          percent,
          done: Math.round(percent / 7),
          total: 15,
          xp: completionFor(assignments, skill).xp,
        };
      }
      if (skill === 'reading' && options?.readingProgress != null) {
        const percent = Math.max(0, Math.min(100, options.readingProgress));
        return {
          key: skill as SkillKey,
          label: LABELS[skill],
          percent,
          done: percent,
          total: 100,
          xp: completionFor(assignments, skill).xp,
        };
      }
      return {
        key: skill as SkillKey,
        label: LABELS[skill],
        ...completionFor(assignments, skill),
      };
    }),
  ];
}

/** Cumulative XP per skill by calendar month (from review timestamps). */
export function computeMonthlyProgress(
  assignments: AssignmentWithActivity[],
  monthsBack = 7,
): MonthlyProgressPoint[] {
  const now = new Date();
  const months: { key: string; label: string; year: number; month: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: d.toLocaleString(undefined, { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }

  type Event = { at: Date; skill: ActivityType; xp: number };
  const events: Event[] = [];

  for (const a of assignments) {
    if (!a.review?.created_at) continue;
    const skill = a.activity?.type;
    if (!skill) continue;
    events.push({
      at: new Date(a.review.created_at),
      skill,
      xp: a.review.xp_awarded ?? 0,
    });
  }

  events.sort((x, y) => x.at.getTime() - y.at.getTime());

  let speaking = 0;
  let reading = 0;
  let writing = 0;
  let listening = 0;
  let ei = 0;

  return months.map((m) => {
    const end = new Date(m.year, m.month + 1, 0, 23, 59, 59, 999);
    while (ei < events.length && events[ei]!.at <= end) {
      const e = events[ei]!;
      if (e.skill === 'speaking') speaking += e.xp;
      if (e.skill === 'reading') reading += e.xp;
      if (e.skill === 'writing') writing += e.xp;
      if (e.skill === 'listening') listening += e.xp;
      ei += 1;
    }
    return {
      month: m.key,
      label: m.label,
      speaking,
      reading,
      writing,
      listening,
      overall: speaking + reading + writing + listening,
    };
  });
}

export function buildActivityFeed(
  assignments: AssignmentWithActivity[],
  attendance: Array<AttendanceMark & { session?: AttendanceSession | null }>,
  limit = 12,
): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];

  for (const a of assignments) {
    const skill = a.activity?.type;
    const title = a.activity?.title || 'Assignment';

    items.push({
      id: `assigned-${a.id}`,
      kind: 'assigned',
      title: `${skill ? capitalize(skill) : 'Task'} assigned`,
      detail: title,
      at: a.created_at,
      assignmentId: a.id,
      skill,
    });

    if (a.submission?.created_at) {
      items.push({
        id: `submitted-${a.submission.id}`,
        kind: 'submitted',
        title: `${skill ? capitalize(skill) : 'Work'} submitted`,
        detail: title,
        at: a.submission.created_at,
        assignmentId: a.id,
        skill,
      });
    }

    if (a.review?.created_at) {
      items.push({
        id: `reviewed-${a.review.id}`,
        kind: 'reviewed',
        title: 'Review complete',
        detail: `${title} · +${a.review.xp_awarded ?? 0} XP`,
        at: a.review.created_at,
        assignmentId: a.id,
        skill,
      });
    }

    if (a.status === 'returned') {
      items.push({
        id: `returned-${a.id}`,
        kind: 'returned',
        title: 'Returned for revision',
        detail: title,
        at: a.updated_at,
        assignmentId: a.id,
        skill,
      });
    }
  }

  for (const m of attendance) {
    items.push({
      id: `attendance-${m.id}`,
      kind: 'attendance',
      title: 'Attendance marked',
      detail: m.session?.session_date || new Date(m.marked_at).toLocaleDateString(),
      at: m.marked_at,
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
