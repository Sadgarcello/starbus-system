import { describe, expect, it } from 'vitest';
import { parseDailyLifeContent, presentationForContentType } from './dailyLifePresentation';

describe('dailyLifePresentation', () => {
  it('maps content types to presentation modes', () => {
    expect(presentationForContentType('EMAIL')).toBe('email');
    expect(presentationForContentType('NOTICE')).toBe('notice');
    expect(presentationForContentType('MENU')).toBe('menu');
  });

  it('keeps plain content when no headers are present', () => {
    const parsed = parseDailyLifeContent('Room 204 is unavailable tomorrow.');
    expect(parsed.headers).toEqual([]);
    expect(parsed.body).toBe('Room 204 is unavailable tomorrow.');
  });

  it('extracts headers only when stored in content', () => {
    const parsed = parseDailyLifeContent(
      'From: Michael Davis\nTo: Ms. Johnson\n\nDear Ms. Johnson,\nYour interview is scheduled.',
    );
    expect(parsed.headers).toHaveLength(2);
    expect(parsed.body).toContain('Dear Ms. Johnson');
  });
});
