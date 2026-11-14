import * as fc from 'fast-check';

import { elapsedMs, isValidTimestamp, MS_PER_DAY, wholeDays } from '@/domain/time';
import { duration, timestamp } from '@test/arbitraries';

describe('isValidTimestamp', () => {
  it.each([0, Date.UTC(2026, 10, 14), 8.64e15])('accepts %p', (value) => {
    expect(isValidTimestamp(value)).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 8.64e15 + 1])('refuses %p', (value) => {
    expect(isValidTimestamp(value)).toBe(false);
  });
});

describe('elapsedMs', () => {
  it('measures the time between two points', () => {
    expect(elapsedMs(1_000, 4_000)).toBe(3_000);
  });

  it('is zero when the clock moved backwards', () => {
    expect(elapsedMs(4_000, 1_000)).toBe(0);
  });

  it('is never negative', () => {
    fc.assert(fc.property(timestamp, timestamp, (from, to) => elapsedMs(from, to) >= 0));
  });
});

describe('wholeDays', () => {
  it('counts only completed days', () => {
    expect(wholeDays(MS_PER_DAY - 1)).toBe(0);
    expect(wholeDays(MS_PER_DAY)).toBe(1);
    expect(wholeDays(2.5 * MS_PER_DAY)).toBe(2);
  });

  it('is zero for a negative duration', () => {
    expect(wholeDays(-MS_PER_DAY)).toBe(0);
  });

  it('never counts a day that has not fully elapsed', () => {
    fc.assert(
      fc.property(duration, (ms) => {
        const days = wholeDays(ms);
        return days * MS_PER_DAY <= ms && ms < (days + 1) * MS_PER_DAY;
      }),
    );
  });
});
