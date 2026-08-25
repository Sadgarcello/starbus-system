import type { ActivityType } from '@/types';

/** Central TanStack Query keys for Khawaja Club */
export const queryKeys = {
  academy: {
    students: ['students'] as const,
    lessons: ['lessons'] as const,
    activities: (type?: ActivityType) => ['activities', type ?? 'all'] as const,
    studentAssignments: (studentId: string) => ['assignments', 'student', studentId] as const,
    pendingReviews: ['assignments', 'pending'] as const,
    assignment: (id: string) => ['assignments', id] as const,
  },
  attendance: {
    session: (date: string) => ['attendance', 'session', date] as const,
    marks: (sessionId: string) => ['attendance', 'marks', sessionId] as const,
    myMark: (sessionId: string, studentId: string) =>
      ['attendance', 'myMark', sessionId, studentId] as const,
    history: (studentId: string) => ['attendance', 'history', studentId] as const,
  },
  speaking: {
    formats: ['speaking', 'formats'] as const,
    votes: ['speaking', 'votes'] as const,
    session: (date: string) => ['speaking', 'session', date] as const,
    marks: (sessionId: string) => ['speaking', 'marks', sessionId] as const,
    myMark: (sessionId: string, studentId: string) =>
      ['speaking', 'myMark', sessionId, studentId] as const,
  },
  reading: {
    books: ['reading', 'books'] as const,
    votes: ['reading', 'votes'] as const,
  },
  writing: {
    tasks: ['writing', 'tasks'] as const,
    submissions: (taskId: string) => ['writing', 'submissions', taskId] as const,
    mySubmission: (taskId: string, studentId: string) =>
      ['writing', 'mine', taskId, studentId] as const,
  },
  listening: {
    picks: ['listening', 'picks'] as const,
  },
  social: {
    profiles: ['social', 'profiles'] as const,
  },
  membership: {
    pending: ['memberships', 'pending'] as const,
    students: ['memberships', 'students'] as const,
  },
  hobbies: {
    catalog: ['hobbies', 'catalog'] as const,
    student: (studentId: string) => ['hobbies', 'student', studentId] as const,
    pendingMine: (studentId: string) => ['hobbies', 'pendingMine', studentId] as const,
    pendingAdmin: ['hobbies', 'pendingAdmin'] as const,
  },
  student: (studentId: string) => ['student', studentId] as const,
  notifications: {
    inbox: ['notifications', 'inbox'] as const,
    unread: ['notifications', 'unread'] as const,
  },
};
