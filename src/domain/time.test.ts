import * as fc from 'fast-check';

import {
  elapsedMs,
  isValidTimestamp,
  MS_PER_DAY,
  MS_PER_MINUTE,
  floorToMinute,
  msUntilNextTick,
  MS_PER_SECOND,
  wholeDays,
} from '@/domain/time';
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

describe('msUntilNextTick', () => {
  const anchor = Date.UTC(2026, 0, 1, 8, 0, 12, 345);

  it('waits a full period when the elapsed time is a whole number of periods', () => {
    expect(msUntilNextTick(anchor, anchor, MS_PER_MINUTE)).toBe(MS_PER_MINUTE);
    expect(msUntilNextTick(anchor + 3 * MS_PER_MINUTE, anchor, MS_PER_MINUTE)).toBe(MS_PER_MINUTE);
  });

  it('follows the periods of the anchor, not those of the wall clock', () => {
    expect(msUntilNextTick(anchor + 40_000, anchor, MS_PER_MINUTE)).toBe(20_000);
    expect(msUntilNextTick(Date.UTC(2026, 0, 1, 9), anchor, MS_PER_MINUTE)).toBe(12_345);
    expect(msUntilNextTick(anchor + 2_400, anchor, MS_PER_SECOND)).toBe(600);
  });

  it('still lands on a period of the anchor when the clock is behind it', () => {
    expect(msUntilNextTick(anchor - 10_000, anchor, MS_PER_MINUTE)).toBe(10_000);
    expect(msUntilNextTick(anchor - 300, anchor, MS_PER_SECOND)).toBe(300);
  });

  it('always schedules a tick within the next period, on a period of the anchor', () => {
    fc.assert(
      fc.property(
        timestamp,
        timestamp,
        fc.constantFrom(MS_PER_SECOND, MS_PER_MINUTE),
        (now, start, period) => {
          const delay = msUntilNextTick(now, start, period);
          return delay > 0 && delay <= period && (now + delay - start) % period === 0;
        },
      ),
    );
  });
});

describe('floorToMinute', () => {
  it('drops the seconds and milliseconds', () => {
    expect(floorToMinute(Date.UTC(2026, 0, 1, 8, 30, 59, 999))).toBe(Date.UTC(2026, 0, 1, 8, 30));
    expect(floorToMinute(Date.UTC(2026, 0, 1, 8, 30))).toBe(Date.UTC(2026, 0, 1, 8, 30));
  });
});
