import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseServerEnv } from './serverEnv.js';
import { verifySupabaseAccessToken } from './pushSend.js';
import {
  assertToeflStudent,
  finishSession,
  getNextQuestion,
  resolveReadingResultsAccess,
  startSession,
  submitAnswer,
} from './readingPracticeEngine.js';
import {
  getStoredSessionReport,
  listSessionHistory,
} from './readingPractice/sessionReport.js';
import type { ReadingPracticeMode, ReadingQuestionType } from './readingPractice/types.js';

type Action = 'start' | 'next' | 'submit' | 'finish' | 'report' | 'history';

const READING_ACTIONS = new Set(['start', 'next', 'submit', 'finish', 'report', 'history']);

export function isReadingPracticeRequest(body: Record<string, unknown>): boolean {
  return READING_ACTIONS.has(String(body.action ?? ''));
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return req.body as Record<string, unknown>;
}

/** TOEFL reading practice — no AI. Routed via /api/reading-practice rewrite. */
export async function handleReadingPractice(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const env = getSupabaseServerEnv();
  if (!env.ok) return res.status(500).json({ error: env.error });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = authHeader.slice(7);
  const user = await verifySupabaseAccessToken(env.supabaseUrl, env.anonKey, token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const raw = parseBody(req);
    const body = raw as {
      action: Action;
      mode?: ReadingPracticeMode;
      length?: number;
      sessionId?: string;
      questionId?: string;
      questionType?: ReadingQuestionType;
      answer?: string;
      responseTimeMs?: number;
      studentId?: string;
    };

    if (body.action === 'report' || body.action === 'history') {
      const access = await resolveReadingResultsAccess(admin, user.id, body.studentId);
      if (body.action === 'report') {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const summary = await getStoredSessionReport(admin, access.studentId, body.sessionId);
        if (!summary) return res.status(404).json({ error: 'report_not_found' });
        return res.status(200).json({ summary });
      }
      const history = await listSessionHistory(admin, access.studentId, {
        mode: body.mode,
        limit: access.isStaff ? 50 : 20,
      });
      return res.status(200).json({ history });
    }

    const studentInfo = await assertToeflStudent(admin, user.id);

    switch (body.action) {
      case 'start': {
        const mode = body.mode ?? 'COMPLETE_WORDS';
        const length = body.length ?? 10;
        const { session } = await startSession(
          admin,
          studentInfo.studentId,
          studentInfo.level,
          mode,
          length,
        );
        const { payload } = await getNextQuestion(admin, studentInfo.studentId, session.id as string);
        return res.status(200).json({ sessionId: session.id, question: payload });
      }
      case 'next': {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const { payload } = await getNextQuestion(admin, studentInfo.studentId, body.sessionId);
        return res.status(200).json({ question: payload });
      }
      case 'submit': {
        if (!body.sessionId || !body.questionId || !body.questionType || body.answer === undefined) {
          return res.status(400).json({ error: 'missing_fields' });
        }
        const result = await submitAnswer(
          admin,
          studentInfo.studentId,
          body.sessionId,
          body.questionId,
          body.questionType,
          body.answer,
          body.responseTimeMs,
        );
        return res.status(200).json(result);
      }
      case 'finish': {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const summary = await finishSession(admin, studentInfo.studentId, body.sessionId);
        return res.status(200).json({ summary });
      }
      default:
        return res.status(400).json({ error: 'invalid_action' });
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'toefl_only') {
      return res.status(403).json({
        error: 'toefl_only',
        message: 'Set your exam track to TOEFL in Settings, then try again.',
      });
    }
    if (msg === 'students_only') {
      return res.status(403).json({
        error: 'students_only',
        message:
          'Reading practice is for student accounts only. Log in as a student (for example Test Student), not as Club Admin or teacher.',
      });
    }
    if (msg === 'forbidden') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You can only view your own reading practice results.',
      });
    }
    if (msg === 'student_id_required') {
      return res.status(400).json({
        error: 'student_id_required',
        message: 'Select a student to view their reading results.',
      });
    }
    if (msg === 'student_not_found') {
      return res.status(404).json({
        error: 'student_not_found',
        message: 'That student could not be found.',
      });
    }
    if (msg === 'account_not_active') {
      return res.status(403).json({
        error: 'account_not_active',
        message: 'Your account is not active yet. Wait for admin approval, then try again.',
      });
    }
    if (msg === 'not_a_student') {
      return res.status(403).json({
        error: 'not_a_student',
        message:
          'Could not link your login to a students record. Confirm Vercel SUPABASE_SERVICE_ROLE_KEY matches the same Supabase project as VITE_SUPABASE_URL, then redeploy.',
        projectRef: env.projectRef,
      });
    }
    if (msg === 'no_questions' || msg === 'no_daily_life_questions' || msg === 'no_academic_questions') {
      return res.status(404).json({
        error: msg,
        message:
          msg === 'no_daily_life_questions'
            ? 'No Daily Life reading questions are available yet. Run migration 0022 (and 0029 for extra content) in Supabase.'
            : msg === 'no_academic_questions'
              ? 'No Academic reading questions are available yet. Run migration 0022 in Supabase, or ask your teacher to add passages.'
              : 'No active questions found. Confirm Vercel SUPABASE_URL matches the project where you ran 0021/0022.',
      });
    }
    if (
      msg === 'no_eligible_daily_life_question' ||
      msg === 'no_eligible_academic_question' ||
      msg === 'no_eligible_question'
    ) {
      return res.status(404).json({
        error: msg,
        message:
          msg === 'no_eligible_daily_life_question'
            ? 'All Daily Life questions for this session were already used. Finish this session and start a new one, or ask your teacher to add more content.'
            : msg === 'no_eligible_academic_question'
              ? 'All Academic questions for this session were already used. Finish this session and start a new one, or ask your teacher to add more passages.'
              : 'No eligible questions remain for this session.',
      });
    }
    if (msg.startsWith('wrong_question_type_for_mode:')) {
      const [, expected, actual] = msg.split(':');
      console.error('[reading-practice] mode mismatch', { expected, actual });
      return res.status(500).json({
        error: 'wrong_question_type_for_mode',
        message: `Practice mode mismatch (expected ${expected}, got ${actual}). Please retry — Daily Life will never show Complete the Words.`,
      });
    }
    if (
      msg.includes('does not exist') ||
      msg.includes('42P01') ||
      (msg.includes('reading_practice') && msg.includes('relation'))
    ) {
      return res.status(503).json({
        error: 'migration_required',
        message:
          'Run migrations 0021, 0022, and 0030_daily_life_contexts.sql in Supabase.',
      });
    }
    console.error('[reading-practice]', e);
    return res.status(500).json({ error: 'reading_practice_failed', message: msg });
  }
}
