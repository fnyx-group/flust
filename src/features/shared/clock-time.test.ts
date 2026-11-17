import { formatClockTime } from '@/features/shared/clock-time';

const NBSP = ' ';

describe('formatClockTime', () => {
  it('writes French times with h, and minutes only when there are some', () => {
    expect(formatClockTime('fr', 21, 0, false)).toBe(`21${NBSP}h`);
    expect(formatClockTime('fr', 21, 14, false)).toBe(`21${NBSP}h${NBSP}14`);
    expect(formatClockTime('fr', 8, 5, false)).toBe(`8${NBSP}h${NBSP}05`);
    expect(formatClockTime('fr', 0, 0, false)).toBe(`0${NBSP}h`);
  });

  it('keeps the platform format elsewhere', () => {
    expect(formatClockTime('en', 21, 14, false)).toBe('21:14');
    expect(formatClockTime('en', 21, 0, true)).toMatch(/^9:00\s?PM$/);
  });

  it('follows a 12 hour clock in French too', () => {
    expect(formatClockTime('fr', 21, 0, true)).not.toContain('h');
  });
});
