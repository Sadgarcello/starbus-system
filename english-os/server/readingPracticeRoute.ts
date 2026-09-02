import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseServerEnv } from './serverEnv.js';
import { verifySupabaseAccessToken } from './pushSend.js';
import {
  assertToeflStudent,
  finishSession,
  getNextQuestion,
  startSession,
  submitAnswer,
} from './readingPracticeEngine.js';
import type { ReadingPracticeMode, ReadingQuestionType } from './readingPractice/types.js';

type Action = 'start' | 'next' | 'submit' | 'finish';

const READING_ACTIONS = new Set(['start', 'next', 'submit', 'finish']);

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
    const studentInfo = await assertToeflStudent(admin, user.id);
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
    };

    switch (body.action) {
      case 'start': {
        const mode = body.mode ?? 'ADAPTIVE';
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
    if (msg === 'not_a_student') return res.status(403).json({ error: 'not_a_student' });
    if (msg === 'no_questions') {
      return res.status(404).json({
        error: 'no_questions',
        message: 'No active questions found. Confirm Vercel SUPABASE_URL matches the project where you ran 0021/0022.',
      });
    }
    if (
      msg.includes('does not exist') ||
      msg.includes('42P01') ||
      (msg.includes('reading_practice') && msg.includes('relation'))
    ) {
      return res.status(503).json({
        error: 'migration_required',
        message: 'Run migrations 0021_reading_practice_engine.sql and 0022_reading_practice_seed.sql in Supabase.',
      });
    }
    console.error('[reading-practice]', e);
    return res.status(500).json({ error: 'reading_practice_failed', message: msg });
  }
}
