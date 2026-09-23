import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseServerEnv } from './serverEnv.js';
import { verifySupabaseAccessToken } from './pushSend.js';
import {
  assertToeflStudent,
  finishWritingDiagnostic,
  getWritingQuota,
  getWritingReport,
  saveWritingDraft,
  startWritingDiagnostic,
  submitWritingItem,
} from './writingPracticeEngine.js';
import type { WritingQuotaInfo } from './writingPractice/types.js';

type Action = 'quota' | 'start' | 'saveDraft' | 'submitItem' | 'finish' | 'report';

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

export async function handleWritingPractice(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const env = getSupabaseServerEnv();
  if (!env.ok) return res.status(500).json({ error: env.error });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });

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
      itemIndex?: number;
      responseText?: string;
    };

    const studentInfo = await assertToeflStudent(admin, user.id);

    if (body.action === 'quota') {
      const quota = await getWritingQuota(admin, studentInfo.studentId);
      return res.status(200).json({ quota });
    }

    switch (body.action) {
      case 'start': {
        try {
          const result = await startWritingDiagnostic(admin, studentInfo.studentId);
          return res.status(200).json(result);
        } catch (e) {
          if ((e as Error).message === 'writing_quota_exceeded') {
            const quota = (e as Error & { quota: WritingQuotaInfo }).quota;
            return res.status(429).json({
              error: 'writing_quota_exceeded',
              message: 'You have used both Writing tests for this 48-hour period.',
              quota,
            });
          }
          throw e;
        }
      }
      case 'saveDraft': {
        if (!body.sessionId || body.itemIndex == null || body.responseText === undefined) {
          return res.status(400).json({ error: 'missing_fields' });
        }
        await saveWritingDraft(
          admin,
          studentInfo.studentId,
          body.sessionId,
          Number(body.itemIndex),
          String(body.responseText),
        );
        return res.status(200).json({ ok: true });
      }
      case 'submitItem': {
        if (!body.sessionId || body.itemIndex == null || body.responseText === undefined) {
          return res.status(400).json({ error: 'missing_fields' });
        }
        const result = await submitWritingItem(
          admin,
          studentInfo.studentId,
          body.sessionId,
          Number(body.itemIndex),
          String(body.responseText),
        );
        return res.status(200).json(result);
      }
      case 'finish': {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const report = await finishWritingDiagnostic(admin, studentInfo.studentId, body.sessionId);
        return res.status(200).json({ report });
      }
      case 'report': {
        if (!body.sessionId) return res.status(400).json({ error: 'session_id_required' });
        const report = await getWritingReport(admin, studentInfo.studentId, body.sessionId);
        return res.status(200).json({ report });
      }
      default:
        return res.status(400).json({ error: 'invalid_action' });
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'toefl_only') {
      return res.status(403).json({ error: 'toefl_only' });
    }
    if (msg.startsWith('insufficient_')) {
      return res.status(503).json({ error: msg, message: 'Add Writing content in admin (migration 0032).' });
    }
    console.error('[writing-practice]', msg);
    return res.status(500).json({ error: 'server_error', message: msg });
  }
}
