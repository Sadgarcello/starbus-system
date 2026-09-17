export type DailyLifePresentation =
  | 'email'
  | 'notice'
  | 'menu'
  | 'schedule'
  | 'message'
  | 'document';

export interface ParsedDailyLifeContent {
  headers: { label: string; value: string }[];
  body: string;
}

const HEADER_LINE = /^(From|To|Subject|Date|Re|CC|Sent):\s*(.+)$/i;

export function presentationForContentType(contentType?: string): DailyLifePresentation {
  const type = (contentType ?? 'DOCUMENT').toUpperCase();
  if (type === 'EMAIL') return 'email';
  if (type === 'NOTICE' || type === 'ANNOUNCEMENT' || type === 'SIGN') return 'notice';
  if (type === 'MENU' || type === 'ADVERTISEMENT' || type === 'AD') return 'menu';
  if (type === 'SCHEDULE' || type === 'TIMETABLE') return 'schedule';
  if (type === 'MESSAGE' || type === 'TEXT' || type === 'SMS') return 'message';
  return 'document';
}

export function presentationLabel(presentation: DailyLifePresentation): string {
  switch (presentation) {
    case 'email':
      return 'Email';
    case 'notice':
      return 'Notice';
    case 'menu':
      return 'Menu';
    case 'schedule':
      return 'Schedule';
    case 'message':
      return 'Message';
    default:
      return 'Reading';
  }
}

/** Pull optional From/To/Subject lines only when they exist in stored content. */
export function parseDailyLifeContent(content: string): ParsedDailyLifeContent {
  const lines = content.split('\n');
  const headers: { label: string; value: string }[] = [];
  let bodyStart = 0;

  for (let i = 0; i < lines.length && i < 10; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line) {
      if (headers.length > 0) {
        bodyStart = i + 1;
        break;
      }
      continue;
    }
    const match = line.match(HEADER_LINE);
    if (match) {
      headers.push({ label: match[1]!, value: match[2]!.trim() });
      bodyStart = i + 1;
      continue;
    }
    if (headers.length > 0) break;
  }

  if (headers.length === 0) {
    return { headers: [], body: content.trim() };
  }

  const body = lines.slice(bodyStart).join('\n').trim();
  return { headers, body: body || content.trim() };
}
