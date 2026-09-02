import type { ActivityType } from '@/types';

export type ExamTrack = 'toefl' | 'ielts' | 'linguaskill';

export const EXAM_TRACKS: ExamTrack[] = ['toefl', 'ielts', 'linguaskill'];

export const EXAM_TRACK_LABELS: Record<ExamTrack, string> = {
  toefl: 'TOEFL iBT',
  ielts: 'IELTS',
  linguaskill: 'Linguaskill',
};

export const EXAM_TRACK_SHORT: Record<ExamTrack, string> = {
  toefl: 'TOEFL',
  ielts: 'IELTS',
  linguaskill: 'Linguaskill',
};

/** Official-style logos in /public/exams */
export const EXAM_TRACK_LOGOS: Record<ExamTrack, string> = {
  toefl: '/exams/toefl.png',
  ielts: '/exams/ielts.png',
  linguaskill: '/exams/linguaskill.png',
};

export interface SkillTrackStyle {
  subtitle: string;
  description: string;
  focusPoints: string[];
  accentClass: string;
  studentTips?: string[];
  formHints?: Record<string, string>;
}

export interface ExamTrackInfo {
  id: ExamTrack;
  label: string;
  tagline: string;
  description: string;
}

export const EXAM_TRACK_INFO: ExamTrackInfo[] = [
  {
    id: 'toefl',
    label: 'TOEFL iBT',
    tagline: 'Academic English for US-style admissions',
    description:
      'Integrated tasks, campus lectures, independent essays, and note-taking under timed conditions.',
  },
  {
    id: 'ielts',
    label: 'IELTS',
    tagline: 'Global academic & general English',
    description:
      'Task 1 reports, Task 2 essays, Parts 1–3 speaking, and varied accents in listening.',
  },
  {
    id: 'linguaskill',
    label: 'Linguaskill',
    tagline: 'Business & adaptive Cambridge English',
    description:
      'Workplace scenarios, adaptive difficulty, concise writing, and practical communication.',
  },
];

const TEACHER_DEFAULT: Record<ActivityType, Omit<SkillTrackStyle, 'accentClass'>> = {
  speaking: {
    subtitle: 'Class speaking practice',
    description:
      'Suggestions for class. Choose one format per day — each student practice adds 7%. Fifteen practices unlock the next level.',
    focusPoints: [],
  },
  reading: {
    subtitle: 'Novels and books with page progress',
    description:
      'Students vote which book to start first. Declared pages finished count toward Reading % for attendees that day.',
    focusPoints: [],
  },
  writing: {
    subtitle: 'End-of-class writing assignments',
    description:
      'Paste typed work or upload a photo of handwritten work for teacher assessment.',
    focusPoints: [],
  },
  listening: {
    subtitle: 'Weekly student listening picks',
    description:
      'Each week one student chooses a clip and explains why, what they understood, and their opinion.',
    focusPoints: [],
  },
};

const STYLES: Record<ExamTrack, Record<ActivityType, SkillTrackStyle>> = {
  toefl: {
    speaking: {
      subtitle: 'TOEFL Speaking — independent & integrated responses',
      description:
        'Practice short timed responses like TOEFL Tasks 1–4: express an opinion, summarize a reading/listening pair, and report on campus life topics.',
      focusPoints: [
        '45–60 second answers with a clear point and two supporting details',
        'Campus/academic topics: housing, registration, lectures, student life',
        'Integrated style: read + listen, then explain how they relate',
      ],
      accentClass: 'border-[#003366]/30 bg-[#003366]/5',
      studentTips: [
        'Use prep time to outline: main idea → reason 1 → reason 2 → quick conclusion',
        'Speak in full sentences — avoid one-word answers',
      ],
    },
    reading: {
      subtitle: 'TOEFL Reading — academic passages',
      description:
        'Build stamina with academic texts: main idea, inference, vocabulary in context, and summary questions like the real exam.',
      focusPoints: [
        'Skim the title and first paragraph before detailed reading',
        'Track pronoun references and cause/effect in science/history passages',
        'Practice eliminating wrong answers in multiple-choice style review',
      ],
      accentClass: 'border-[#003366]/30 bg-[#003366]/5',
    },
    writing: {
      subtitle: 'TOEFL Writing — integrated + independent essays',
      description:
        'Train for the Integrated task (read + listen + write) and Independent task (opinion essay ~300 words) with clear structure under time pressure.',
      focusPoints: [
        'Integrated: 150–225 words summarizing how lecture relates to reading',
        'Independent: 300+ words — intro, two body paragraphs, conclusion',
        'Use academic connectors: however, furthermore, as a result',
      ],
      accentClass: 'border-[#003366]/30 bg-[#003366]/5',
      formHints: {
        placeholder: 'Write your TOEFL-style response (aim for clear paragraphs and academic tone)…',
      },
    },
    listening: {
      subtitle: 'TOEFL Listening — lectures & conversations',
      description:
        'Choose clips that mirror TOEFL: campus conversations, office hours, and short academic lectures. Take notes on main idea and supporting details.',
      focusPoints: [
        '2–5 min English audio — lectures or student–staff dialogues',
        'Note: main idea, two details, speaker attitude or purpose',
        'Explain how the clip would appear on a TOEFL listening question',
      ],
      accentClass: 'border-[#003366]/30 bg-[#003366]/5',
      formHints: {
        whatUnderstood: 'Main idea + two supporting details (TOEFL note-taking style)',
        opinion: 'How confident are you with lecture-style listening? What was hardest?',
      },
    },
  },
  ielts: {
    speaking: {
      subtitle: 'IELTS Speaking — Parts 1, 2 & 3',
      description:
        'Mirror IELTS format: Part 1 familiar topics, Part 2 long turn (cue card), Part 3 discussion — fluency, vocabulary range, and coherence.',
      focusPoints: [
        'Part 1: short personal answers (work, study, hometown, hobbies)',
        'Part 2: 1–2 minute monologue from a cue card with bullet points',
        'Part 3: abstract follow-ups — compare, speculate, evaluate',
      ],
      accentClass: 'border-[#C8102E]/25 bg-[#C8102E]/5',
      studentTips: [
        'Extend answers: answer → reason → example',
        'Part 2: use the full minute — describe, compare, and give a personal example',
      ],
    },
    reading: {
      subtitle: 'IELTS Reading — skimming, scanning & matching',
      description:
        'Practice IELTS Academic reading: True/False/Not Given mindset, heading matching, and completing summaries from long passages.',
      focusPoints: [
        'Skim for structure; scan for names, dates, and keywords',
        'Watch for paraphrase — the answer uses different words than the text',
        'Manage time: ~20 minutes per passage in exam conditions',
      ],
      accentClass: 'border-[#C8102E]/25 bg-[#C8102E]/5',
    },
    writing: {
      subtitle: 'IELTS Writing — Task 1 & Task 2',
      description:
        'Task 1: describe charts, graphs, or processes (150 words). Task 2: discursive/argument essay (250+ words) with a clear position.',
      focusPoints: [
        'Task 1: overview paragraph first, then key trends with data',
        'Task 2: four-paragraph essay — intro, two ideas, conclusion',
        'Formal register; avoid contractions in Task 2',
      ],
      accentClass: 'border-[#C8102E]/25 bg-[#C8102E]/5',
      formHints: {
        placeholder: 'Write your IELTS-style response (Task 1 report or Task 2 essay)…',
      },
    },
    listening: {
      subtitle: 'IELTS Listening — Sections 1–4',
      description:
        'Pick clips with varied accents (UK, US, AU). Practice form-filling, map labeling, and lecture note-taking like IELTS Sections 1–4.',
      focusPoints: [
        '2–5 min English audio — conversations and monologues',
        'Note spelling of names/places — IELTS traps on similar sounds',
        'Section 4 style: academic lecture — predict topic from introduction',
      ],
      accentClass: 'border-[#C8102E]/25 bg-[#C8102E]/5',
      formHints: {
        whatUnderstood: 'Key facts you would write on an IELTS answer sheet',
        opinion: 'Which accent or section type was easiest/hardest for you?',
      },
    },
  },
  linguaskill: {
    speaking: {
      subtitle: 'Linguaskill Speaking — workplace scenarios',
      description:
        'Practice short workplace conversations: giving opinions in meetings, describing problems, and responding to everyday business situations.',
      focusPoints: [
        'Clear, professional tone — polite but direct',
        'Scenario responses: email follow-up, project update, customer call',
        'Adaptive difficulty: longer answers show higher level',
      ],
      accentClass: 'border-[#005EB8]/25 bg-[#005EB8]/5',
      studentTips: [
        'Structure: situation → your action → result',
        'Use workplace vocabulary: deadline, colleague, client, schedule',
      ],
    },
    reading: {
      subtitle: 'Linguaskill Reading — workplace texts',
      description:
        'Read emails, notices, reports, and short articles — match meaning, complete gaps, and identify tone in business contexts.',
      focusPoints: [
        'Emails and memos: who, action required, deadline',
        'Multi-part texts: link headings to paragraphs quickly',
        'Adaptive: accuracy at speed unlocks harder texts',
      ],
      accentClass: 'border-[#005EB8]/25 bg-[#005EB8]/5',
    },
    writing: {
      subtitle: 'Linguaskill Writing — email & short essay',
      description:
        'Part 1: short email/message (50+ words). Part 2: longer report or essay (180+ words) on a workplace or social topic.',
      focusPoints: [
        'Email: correct greeting, purpose in line 1, clear request/close',
        'Long task: headings or clear paragraphs for readability',
        'Professional but natural English — not overly academic',
      ],
      accentClass: 'border-[#005EB8]/25 bg-[#005EB8]/5',
      formHints: {
        placeholder: 'Write your Linguaskill-style email or short report…',
      },
    },
    listening: {
      subtitle: 'Linguaskill Listening — business & social audio',
      description:
        'Choose clips with meetings, announcements, interviews, or phone calls. Focus on gist, detail, and speaker purpose in work settings.',
      focusPoints: [
        '2–5 min English audio — office, shop, or service contexts',
        'Identify purpose: inform, persuade, apologise, request',
        'Note numbers, times, and action items',
      ],
      accentClass: 'border-[#005EB8]/25 bg-[#005EB8]/5',
      formHints: {
        whatUnderstood: 'Main message and any action items (workplace listening)',
        opinion: 'Was the situation formal or informal? How clear was the speaker?',
      },
    },
  },
};

export function getExamTrackLabel(track: ExamTrack | null | undefined): string {
  if (!track) return 'Not selected';
  return EXAM_TRACK_LABELS[track];
}

export function getSkillTrackStyle(
  skill: ActivityType,
  examTrack: ExamTrack | null | undefined,
  isTeacher = false,
): SkillTrackStyle {
  if (isTeacher || !examTrack) {
    const base = TEACHER_DEFAULT[skill];
    return { ...base, accentClass: 'border-paper-line bg-paper-soft/50' };
  }
  return STYLES[examTrack][skill];
}

export function getListeningRules(examTrack: ExamTrack | null | undefined): string[] {
  const style = examTrack ? STYLES[examTrack].listening : null;
  if (style?.focusPoints.length) {
    return style.focusPoints.slice(0, 4);
  }
  return ['2–5 minutes', 'Clean language', 'English audio', 'Interesting topic'];
}
