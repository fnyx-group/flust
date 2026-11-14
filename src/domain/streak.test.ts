import * as fc from 'fast-check';

import { addLapse, removeLapse, type Journey } from '@/domain/journey';
import {
  counterSize,
  currentStreakMs,
  longestStreakMs,
  remainingParts,
  streakDisplay,
  streakStart,
  totalCleanDays,
} from '@/domain/streak';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, wholeDays, type Timestamp } from '@/domain/time';
import { duration, journeyFrom, journeyInput, journeyOf, unwrap } from '@test/arbitraries';

const start = Date.UTC(2026, 0, 1, 8);
const days = (n: number) => n * MS_PER_DAY;

function withLapses(...offsets: number[]): Journey {
  return journeyOf(
    start,
    offsets.map((offset) => start + offset),
  );
}

const journeyWithLaterNow = journeyInput.chain((input) => fc.tuple(fc.constant(input), duration));

const clockShift = fc.integer({ min: -days(30), max: days(30) });

function referenceTotalCleanDays(start: Timestamp, lapses: Timestamp[], now: Timestamp): number {
  const sortedLapses = [...lapses].sort((a, b) => a - b);
  let previous = start;
  let total = 0;
  for (const point of [...sortedLapses.map((lapse) => Math.min(lapse, now)), now]) {
    total += wholeDays(point - previous);
    previous = point;
  }
  return total;
}

function referenceCurrentStreakMs(start: Timestamp, lapses: Timestamp[], now: Timestamp): number {
  return Math.max(0, now - Math.max(start, ...lapses));
}

describe('current streak', () => {
  it('runs from the start when there is no lapse', () => {
    const journey = withLapses();
    expect(streakStart(journey)).toBe(start);
    expect(currentStreakMs(journey, start + days(3))).toBe(days(3));
  });

  it('runs from the latest lapse', () => {
    const journey = withLapses(days(1), days(2));
    expect(streakStart(journey)).toBe(start + days(2));
    expect(currentStreakMs(journey, start + days(5))).toBe(days(3));
  });

  it('restarts from the later of two lapses on the same day', () => {
    const journey = withLapses(days(2), days(2) + 4 * MS_PER_HOUR);
    expect(currentStreakMs(journey, start + days(3))).toBe(20 * MS_PER_HOUR);
  });

  it('is zero when the clock moved back before the latest lapse', () => {
    expect(currentStreakMs(withLapses(days(4)), start + days(2))).toBe(0);
  });
});

describe('totalCleanDays', () => {
  it('counts the whole days of each segment', () => {
    const journey = withLapses(days(2.5), days(4));
    expect(totalCleanDays(journey, start + days(7.9))).toBe(2 + 1 + 3);
  });

  it('loses at most the partial day a backdated lapse interrupts', () => {
    const now = start + days(7.5);
    expect(totalCleanDays(withLapses(), now)).toBe(7);
    expect(totalCleanDays(withLapses(days(3.7)), now)).toBe(6);
  });

  it('counts a day on elapsed time, not on calendar midnight', () => {
    const lateEvening = Date.UTC(2026, 4, 10, 23);
    const journey = journeyOf(lateEvening);
    expect(totalCleanDays(journey, lateEvening + 90 * MS_PER_MINUTE)).toBe(0);
    expect(streakDisplay(currentStreakMs(journey, lateEvening + 90 * MS_PER_MINUTE))).toEqual({
      unit: 'hours',
      hours: 1,
      minutes: 30,
    });
  });

  it('counts February 29 as a normal day', () => {
    const journey = journeyOf(Date.UTC(2028, 1, 28));
    expect(totalCleanDays(journey, Date.UTC(2028, 2, 1))).toBe(2);
  });

  it('is not affected by a daylight saving time change', () => {
    const parisNoonBeforeChange = Date.UTC(2026, 2, 28, 11);
    const parisNoonAfterChange = Date.UTC(2026, 2, 29, 10);
    const journey = journeyOf(parisNoonBeforeChange);
    expect(totalCleanDays(journey, parisNoonAfterChange)).toBe(0);
    expect(currentStreakMs(journey, parisNoonAfterChange)).toBe(23 * MS_PER_HOUR);
    expect(totalCleanDays(journey, parisNoonBeforeChange + MS_PER_DAY)).toBe(1);
  });

  it('is zero when the clock moved back before the start', () => {
    expect(totalCleanDays(withLapses(days(1)), start - days(3))).toBe(0);
  });

  it('ignores time after now when the clock moved back between lapses', () => {
    const journey = withLapses(days(2), days(6));
    expect(totalCleanDays(journey, start + days(4.5))).toBe(4);
  });
});

describe('longestStreakMs', () => {
  it('finds the longest segment', () => {
    expect(longestStreakMs(withLapses(days(1), days(6)), start + days(8))).toBe(days(5));
  });

  it('includes the current segment', () => {
    expect(longestStreakMs(withLapses(days(1)), start + days(8))).toBe(days(7));
  });

  it('is zero when the clock moved back before the start', () => {
    expect(longestStreakMs(withLapses(), start - 1)).toBe(0);
  });
});

describe('streakDisplay', () => {
  it('shows hours and minutes under a day', () => {
    expect(streakDisplay(23 * MS_PER_HOUR + 59 * MS_PER_MINUTE + 59_999)).toEqual({
      unit: 'hours',
      hours: 23,
      minutes: 59,
    });
  });

  it('shows whole days from 24 hours', () => {
    expect(streakDisplay(MS_PER_DAY)).toEqual({ unit: 'days', days: 1 });
    expect(streakDisplay(days(3.9))).toEqual({ unit: 'days', days: 3 });
  });

  it('shows zero for a negative duration', () => {
    expect(streakDisplay(-MS_PER_HOUR)).toEqual({ unit: 'hours', hours: 0, minutes: 0 });
  });

  it('shows the last completed day, or the last completed minute under a day', () => {
    fc.assert(
      fc.property(duration, (ms) => {
        const display = streakDisplay(ms);
        if (display.unit === 'days') {
          expect(ms).toBeGreaterThanOrEqual(MS_PER_DAY);
          expect(display.days * MS_PER_DAY).toBeLessThanOrEqual(ms);
          expect(ms).toBeLessThan((display.days + 1) * MS_PER_DAY);
        } else {
          expect(ms).toBeLessThan(MS_PER_DAY);
          expect(display.minutes).toBeLessThanOrEqual(59);
          const shown = display.hours * MS_PER_HOUR + display.minutes * MS_PER_MINUTE;
          expect(shown).toBeLessThanOrEqual(ms);
          expect(ms).toBeLessThan(shown + MS_PER_MINUTE);
        }
      }),
    );
  });
});

describe('properties', () => {
  it('counts the whole days of each segment between start, lapses and now', () => {
    fc.assert(
      fc.property(journeyInput, clockShift, (input, shift) => {
        const now = input.now + shift;
        expect(totalCleanDays(journeyFrom(input), now)).toBe(
          referenceTotalCleanDays(input.start, input.lapses, now),
        );
      }),
    );
  });

  it('runs the current streak from the latest of the start and the lapses', () => {
    fc.assert(
      fc.property(journeyInput, clockShift, (input, shift) => {
        const now = input.now + shift;
        expect(currentStreakMs(journeyFrom(input), now)).toBe(
          referenceCurrentStreakMs(input.start, input.lapses, now),
        );
      }),
    );
  });

  it('never gives a negative streak or total, whatever the clock says', () => {
    fc.assert(
      fc.property(journeyInput, clockShift, (input, shift) => {
        const journey = journeyFrom(input);
        const now = input.now + shift;
        expect(currentStreakMs(journey, now)).toBeGreaterThanOrEqual(0);
        expect(longestStreakMs(journey, now)).toBeGreaterThanOrEqual(0);
        expect(totalCleanDays(journey, now)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('never counts more days than have elapsed since the start', () => {
    fc.assert(
      fc.property(journeyInput, (input) => {
        const journey = journeyFrom(input);
        const elapsed = input.now - input.start;
        expect(totalCleanDays(journey, input.now)).toBeLessThanOrEqual(wholeDays(elapsed));
        expect(longestStreakMs(journey, input.now)).toBeLessThanOrEqual(elapsed);
      }),
    );
  });

  it('loses at most one day per lapse', () => {
    fc.assert(
      fc.property(journeyInput, (input) => {
        const journey = journeyFrom(input);
        expect(totalCleanDays(journey, input.now)).toBeGreaterThanOrEqual(
          wholeDays(input.now - input.start) - input.lapses.length,
        );
      }),
    );
  });

  it('never shows a current streak longer than the longest or than the total', () => {
    fc.assert(
      fc.property(journeyInput, (input) => {
        const journey = journeyFrom(input);
        const current = currentStreakMs(journey, input.now);
        expect(longestStreakMs(journey, input.now)).toBeGreaterThanOrEqual(current);
        expect(totalCleanDays(journey, input.now)).toBeGreaterThanOrEqual(wholeDays(current));
      }),
    );
  });

  it('lowers the total by at most one day when a lapse is added', () => {
    fc.assert(
      fc.property(
        journeyInput.chain((input) =>
          fc.tuple(fc.constant(input), fc.integer({ min: input.start, max: input.now })),
        ),
        ([input, at]) => {
          const before = totalCleanDays(journeyFrom(input), input.now);
          const after = totalCleanDays(
            unwrap(addLapse(journeyFrom(input), at, input.now)),
            input.now,
          );
          expect(after).toBeLessThanOrEqual(before);
          expect(after).toBeGreaterThanOrEqual(before - 1);
        },
      ),
    );
  });

  it('restores the previous streak and total when a lapse is undone', () => {
    fc.assert(
      fc.property(
        journeyInput.chain((input) =>
          fc.tuple(fc.constant(input), fc.integer({ min: input.start, max: input.now })),
        ),
        ([input, at]) => {
          const before = journeyFrom(input);
          const undone = unwrap(removeLapse(unwrap(addLapse(before, at, input.now)), at));
          expect(currentStreakMs(undone, input.now)).toBe(currentStreakMs(before, input.now));
          expect(longestStreakMs(undone, input.now)).toBe(longestStreakMs(before, input.now));
          expect(totalCleanDays(undone, input.now)).toBe(totalCleanDays(before, input.now));
        },
      ),
    );
  });

  it('never decreases as time passes and never jumps ahead of the clock', () => {
    fc.assert(
      fc.property(journeyWithLaterNow, ([input, later]) => {
        const journey = journeyFrom(input);
        const now = input.now;
        expect(currentStreakMs(journey, now + later)).toBe(currentStreakMs(journey, now) + later);
        expect(longestStreakMs(journey, now + later)).toBeGreaterThanOrEqual(
          longestStreakMs(journey, now),
        );
        const gained = totalCleanDays(journey, now + later) - totalCleanDays(journey, now);
        expect(gained).toBeGreaterThanOrEqual(0);
        expect(gained).toBeLessThanOrEqual(wholeDays(later) + 1);
      }),
    );
  });

  it('counts no more after the clock moved back than before', () => {
    fc.assert(
      fc.property(journeyWithLaterNow, ([input, back]) => {
        const journey = journeyFrom(input);
        const earlier = input.now - back;
        expect(totalCleanDays(journey, earlier)).toBeLessThanOrEqual(
          totalCleanDays(journey, input.now),
        );
        expect(currentStreakMs(journey, earlier)).toBeLessThanOrEqual(
          currentStreakMs(journey, input.now),
        );
        expect(longestStreakMs(journey, earlier)).toBeLessThanOrEqual(
          longestStreakMs(journey, input.now),
        );
      }),
    );
  });
});

describe('counterSize', () => {
  it.each([
    [{ unit: 'days', days: 1 }, 'large'],
    [{ unit: 'days', days: 99 }, 'large'],
    [{ unit: 'days', days: 100 }, 'medium'],
    [{ unit: 'days', days: 999 }, 'medium'],
    [{ unit: 'days', days: 1000 }, 'small'],
    [{ unit: 'days', days: 12_000 }, 'small'],
    [{ unit: 'hours', hours: 0, minutes: 0 }, 'hoursMedium'],
    [{ unit: 'hours', hours: 9, minutes: 59 }, 'hoursMedium'],
    [{ unit: 'hours', hours: 10, minutes: 0 }, 'hoursSmall'],
    [{ unit: 'hours', hours: 23, minutes: 59 }, 'hoursSmall'],
  ] as const)('sizes %o as %s', (display, size) => {
    expect(counterSize(display)).toBe(size);
  });
});

describe('remainingParts', () => {
  it('rounds up to the minute', () => {
    expect(remainingParts(16 * MS_PER_HOUR + 19 * MS_PER_MINUTE + 30_000)).toEqual({
      hours: 16,
      minutes: 20,
    });
    expect(remainingParts(MS_PER_HOUR)).toEqual({ hours: 1, minutes: 0 });
  });

  it('is zero once the time has run out', () => {
    expect(remainingParts(-5_000)).toEqual({ hours: 0, minutes: 0 });
  });

  it('adds up with the elapsed time shown by the counter to 24 hours', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MS_PER_DAY - 1 }), (elapsed) => {
        const shown = streakDisplay(elapsed);
        const left = remainingParts(MS_PER_DAY - elapsed);
        if (shown.unit !== 'hours') return false;
        return (shown.hours + left.hours) * 60 + shown.minutes + left.minutes === 24 * 60;
      }),
    );
  });
});
