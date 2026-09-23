import type { WritingErrorItem } from './types.js';

export type RecurringMap = Record<string, number>;

export function tallyErrors(errors: WritingErrorItem[]): RecurringMap {
  const map: RecurringMap = {};
  for (const e of errors) {
    const key = normalizeCategory(e.error_type);
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}

export function mergeRecurring(existing: RecurringMap, delta: RecurringMap): RecurringMap {
  const out = { ...existing };
  for (const [k, v] of Object.entries(delta)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function topRecurring(map: RecurringMap, limit = 5): { category: string; totalCount: number }[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, totalCount]) => ({ category, totalCount }));
}

export function recurringSummaryForPrompt(map: RecurringMap): string {
  const top = topRecurring(map, 6);
  if (top.length === 0) return 'No prior recurring patterns recorded.';
  return top.map((t) => `${t.category}: ${t.totalCount} total`).join('; ');
}

function normalizeCategory(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('PUNCT')) return 'PUNCTUATION';
  if (t.includes('CAPITAL')) return 'CAPITALIZATION';
  if (t.includes('WORD_FORM')) return 'WORD_FORM';
  if (t.includes('COLLOC')) return 'COLLOCATION';
  if (t.includes('SPELL')) return 'SPELLING';
  if (t.includes('SUBJECT') || t.includes('VERB')) return 'SUBJECT_VERB_AGREEMENT';
  if (t.includes('DEVELOP')) return 'IDEA_DEVELOPMENT';
  return t;
}
