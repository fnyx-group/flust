import {
  formatFullDate,
  formatHour,
  formatMinute,
  formatWeekdays,
} from '@/features/onboarding/start-picker/format';

// Exact wording belongs to the platform's locale data, so these tests only check what flust
// decides: the fields are never shifted by a time zone, and the week starts on the given day.
describe('picker formats', () => {
  it('format the local fields as given, whatever the device time zone', () => {
    expect(formatFullDate('en', { year: 2026, month: 3, day: 29 })).toContain('29');
    expect(formatFullDate('en', { year: 2026, month: 3, day: 29 })).toContain('Sunday');
    expect(formatFullDate('fr', { year: 2026, month: 1, day: 1 })).toContain('jeudi');
  });

  it('follow the 12 or 24 hour setting', () => {
    expect(formatHour('en', 21, true)).toContain('9');
    expect(formatHour('en', 21, false)).toContain('21');
    expect(formatMinute(5)).toBe('05');
    expect(formatMinute(45)).toBe('45');
  });

  it('start weeks on the given day', () => {
    expect(formatWeekdays('en', 2)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(formatWeekdays('en', 1)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });
});
