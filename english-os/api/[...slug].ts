import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleEvaluateText } from '../server/evaluateTextRoute.js';
import { handlePushThisDevice } from '../server/pushThisDeviceRoute.js';
import { handleReadingPractice } from '../server/readingPracticeRoute.js';
import { handleSendPush } from '../server/sendPushRoute.js';

/** Single serverless entry — routes /api/* (Hobby plan function limit). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam.join('/') : String(slugParam ?? '');

  switch (slug) {
    case 'reading-practice':
      return handleReadingPractice(req, res);
    case 'evaluate-text':
      return handleEvaluateText(req, res);
    case 'send-push':
      return handleSendPush(req, res);
    case 'push-this-device':
      return handlePushThisDevice(req, res);
    default:
      return res.status(404).json({ error: 'not_found', path: slug || '(empty)' });
  }
}
