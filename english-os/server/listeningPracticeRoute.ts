import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseServerEnv } from './serverEnv.js';
import { verifySupabaseAccessToken } from './pushSend.js';
import {
  acknowledgeStimulusPlayback,
  advanceListeningSession,
  assertToeflStudent,
  finishListeningSession,
  startListeningSession,
  submitListeningAnswer,
} from './listeningPracticeEngine.js';

type Action = 'start' | 'advance' | 'ackStimulus' | 'submit' | 'finish' | 'report';

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

export async function handleListeningPractice(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

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
    const body = parseBody(req) as {
      action: Action;
      sessionId?: string;
      questionId?: string;
      answer?: string;
      responseTimeMs?: number;
    };

    if (body.action === 'report') {
      const studentInfo = await assertToeflStudent(admin, user.id);
      if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
      const { data: session } = await admin
        .from('listening_practice_sessions')
        .select('results_report, student_id')
        .eq('id', body.sessionId)
        .maybeSingle();
      if (!session || session.student_id !== studentInfo.studentId) {
        return res.status(404).json({ error: 'report_not_found' });
      }
      return res.status(200).json({ summary: session.results_report });
    }

    const studentInfo = await assertToeflStudent(admin, user.id);

    switch (body.action) {
      case 'start': {
        const result = await startListeningSession(admin, studentInfo.studentId);
        return res.status(200).json(result);
      }
      case 'advance': {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const step = await advanceListeningSession(admin, studentInfo.studentId, body.sessionId);
        return res.status(200).json({ step });
      }
      case 'ackStimulus': {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const step = await acknowledgeStimulusPlayback(
          admin,
          studentInfo.studentId,
          body.sessionId,
        );
        return res.status(200).json({ step });
      }
      case 'submit': {
        if (!body.sessionId || !body.questionId || body.answer === undefined) {
          return res.status(400).json({ error: 'missing_fields' });
        }
        const result = await submitListeningAnswer(
          admin,
          studentInfo.studentId,
          body.sessionId,
          body.questionId,
          String(body.answer),
          body.responseTimeMs,
        );
        return res.status(200).json(result);
      }
      case 'finish': {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const result = await finishListeningSession(admin, studentInfo.studentId, body.sessionId);
        return res.status(200).json({ summary: result.summary, step: result });
      }
      default:
        return res.status(400).json({ error: 'invalid_action' });
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'toefl_only') {
      return res.status(403).json({ error: 'toefl_only', message: 'Set your exam track to TOEFL in Settings.' });
    }
    if (msg === 'no_listening_content') {
      return res.status(503).json({
        error: 'no_listening_content',
        message: 'No published listening content yet. Run migration 0031 and add stimuli in Listening Admin.',
      });
    }
    console.error('[listening-practice]', msg);
    return res.status(500).json({ error: 'server_error', message: msg });
  }
}
