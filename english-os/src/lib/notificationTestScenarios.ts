import type { NotificationTestScenario } from '@/types';

export type NotificationTestScenarioMeta = {
  id: NotificationTestScenario;
  label: string;
  audience: string;
  description: string;
};

export const NOTIFICATION_TEST_SCENARIOS: NotificationTestScenarioMeta[] = [
  {
    id: 'registration',
    label: 'New join request',
    audience: 'Admins',
    description: 'Mirrors a student registration awaiting approval.',
  },
  {
    id: 'content_writing',
    label: 'New writing task',
    audience: 'Students',
    description: 'Mirrors a teacher opening a writing assignment.',
  },
  {
    id: 'content_speaking',
    label: 'Speaking topic live',
    audience: 'Students',
    description: 'Mirrors opening today’s speaking session.',
  },
  {
    id: 'content_reading',
    label: 'New reading book',
    audience: 'Students',
    description: 'Mirrors adding a book to the library.',
  },
  {
    id: 'assignment',
    label: 'Activity assigned',
    audience: 'Students',
    description: 'Mirrors a new studio assignment.',
  },
  {
    id: 'submission_writing',
    label: 'Writing submitted',
    audience: 'Teachers',
    description: 'Mirrors a student handing in writing.',
  },
  {
    id: 'submission_assignment',
    label: 'Assignment submitted',
    audience: 'Teachers',
    description: 'Mirrors a student submitting an activity.',
  },
  {
    id: 'submission_listening',
    label: 'New listening pick',
    audience: 'Teachers',
    description: 'Mirrors a student sharing a listening clip.',
  },
];
