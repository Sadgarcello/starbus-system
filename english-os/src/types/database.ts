export type UserRole = 'admin' | 'teacher' | 'student';

export type AccountStatus = 'pending' | 'active' | 'rejected';

export type ActivityType = 'speaking' | 'reading' | 'writing' | 'listening';

export type AssignmentStatus = 'assigned' | 'submitted' | 'reviewed' | 'returned';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: AccountStatus;
  requested_role: UserRole;
  avatar: string | null;
  /** Present after 0004; treat missing as false. */
  is_locked?: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  level: string;
  joined_date: string;
  current_course: string | null;
  xp: number;
  streak: number;
  subscription: string | null;
  teacher_id: string | null;
  /** 0–100; +7 per speaking day practice; 15 sessions → level up */
  speaking_progress?: number;
  /** 0–100; set from book pages finished, only for students who attended that day */
  reading_progress?: number;
  created_at: string;
}

export interface SpeakingFormat {
  id: string;
  slug: string;
  title: string;
  details: string;
  goal: string;
  sort_order: number;
  created_at: string;
}

export interface SpeakingDaySession {
  id: string;
  session_date: string;
  format_id: string;
  status: 'open' | 'closed';
  chosen_by: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
}

export interface SpeakingDaySessionWithFormat extends SpeakingDaySession {
  format: SpeakingFormat;
}

export interface SpeakingPracticeMark {
  id: string;
  session_id: string;
  student_id: string;
  marked_at: string;
}

export interface SpeakingFormatVote {
  student_id: string;
  format_id: string;
  created_at: string;
  updated_at: string;
}

export interface SpeakingFormatVoter {
  student_id: string;
  format_id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

export interface ReadingBook {
  id: string;
  title: string;
  author: string | null;
  cover_path: string | null;
  total_pages: number;
  pages_finished: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadingBookVoter {
  student_id: string;
  book_id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

export type WritingTaskStatus = 'open' | 'closed';
export type WritingSubmissionStatus = 'submitted' | 'reviewed';

export interface WritingTask {
  id: string;
  title: string;
  instructions: string;
  session_date: string;
  status: WritingTaskStatus;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface WritingSubmission {
  id: string;
  task_id: string;
  student_id: string;
  body_text: string | null;
  photo_path: string | null;
  status: WritingSubmissionStatus;
  feedback: string | null;
  grade: string | null;
  reviewed_by: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface WritingSubmissionWithStudent extends WritingSubmission {
  student?: {
    id: string;
    profile?: { name: string | null; email: string; avatar: string | null } | null;
  } | null;
}

export interface ListeningPick {
  id: string;
  student_id: string;
  clip_name: string;
  topic: string;
  url: string | null;
  why_chose: string;
  what_understood: string;
  opinion: string;
  created_at: string;
}

export interface ListeningPickWithStudent extends ListeningPick {
  student?: {
    id: string;
    profile?: { name: string | null; email: string; avatar: string | null } | null;
  } | null;
}

/** Public classmate card — no email */
export interface SocialProfile {
  student_id: string;
  name: string;
  avatar: string | null;
  level: string;
  xp: number;
  streak: number;
  speaking_progress: number;
  reading_progress: number;
  joined_date: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string | null;
  title: string;
  week: number | null;
  theme: string | null;
  novel: string | null;
  chapter: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  lesson_id: string | null;
  type: ActivityType;
  title: string;
  description: string | null;
  xp: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  activity_id: string;
  student_id: string;
  status: AssignmentStatus;
  due_at: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  submission_id: string;
  reviewer_id: string;
  feedback: string | null;
  scores: Record<string, unknown>;
  grade: string | null;
  xp_awarded: number;
  created_at: string;
}

export type AttendanceSessionStatus = 'open' | 'closed';

export interface AttendanceSession {
  id: string;
  session_date: string;
  status: AttendanceSessionStatus;
  opened_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface AttendanceMark {
  id: string;
  session_id: string;
  student_id: string;
  marked_at: string;
}

export interface AttendanceMarkWithStudent extends AttendanceMark {
  student: StudentWithProfile;
}

/** Joined shapes used by dashboards */
export interface AssignmentWithActivity extends Assignment {
  activity: Activity;
  submission?: Submission | null;
  review?: Review | null;
}

export interface StudentWithProfile extends Student {
  profile: Profile;
}

export type HobbySuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface Hobby {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface HobbySuggestion {
  id: string;
  student_id: string;
  raw_text: string;
  status: HobbySuggestionStatus;
  resolved_hobby_id: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface HobbySuggestionWithStudent extends HobbySuggestion {
  student: StudentWithProfile;
}

export interface StudentHobby {
  student_id: string;
  hobby_id: string;
  created_at: string;
  hobby: Hobby;
}

export type NotificationType =
  | 'registration'
  | 'content_speaking'
  | 'content_writing'
  | 'content_reading'
  | 'content_listening'
  | 'assignment'
  | 'submission_writing'
  | 'submission_assignment'
  | 'submission_listening';

export type NotificationTestScenario =
  | 'registration'
  | 'content_writing'
  | 'content_speaking'
  | 'content_reading'
  | 'assignment'
  | 'submission_writing'
  | 'submission_assignment'
  | 'submission_listening';

export interface NotificationTestResult {
  scenario: NotificationTestScenario;
  type: NotificationType;
  audience: string;
  sent_count: number;
  notification_ids?: string[];
}

export interface PushDispatchStatus {
  push_configured: boolean;
  has_functions_url: boolean;
  has_dispatch_secret: boolean;
  functions_base_url?: string | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link_path: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}
