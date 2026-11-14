import * as fc from 'fast-check';

import { duration, journeyFrom, journeyInput, valueOf } from '@/domain/arbitraries';
import { addLapse, removeLapse, type Journey } from '@/domain/journey';
import {
  currentStreakMs,
  longestStreakMs,
  streakDisplay,
  streakStart,
  totalCleanDays,
} from '@/domain/streak';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, wholeDays } from '@/domain/time';

const start = Date.UTC(2026, 0, 1, 8);
const days = (n: number) => n * MS_PER_DAY;

function withLapses(...offsets: number[]): Journey {
  return { start, lapses: offsets.map((offset) => start + offset) };
}

const journeyWithLaterNow = journeyInput.chain((input) => fc.tuple(fc.constant(input), duration));

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
    const journey: Journey = { start: lateEvening, lapses: [] };
    expect(totalCleanDays(journey, lateEvening + 90 * MS_PER_MINUTE)).toBe(0);
    expect(streakDisplay(currentStreakMs(journey, lateEvening + 90 * MS_PER_MINUTE))).toEqual({
      unit: 'hours',
      hours: 1,
      minutes: 30,
    });
  });

  it('counts February 29 as a normal day', () => {
    const journey: Journey = { start: Date.UTC(2028, 1, 28), lapses: [] };
    expect(totalCleanDays(journey, Date.UTC(2028, 2, 1))).toBe(2);
  });

  it('is not affected by a daylight saving time change', () => {
    const parisNoonBeforeChange = Date.UTC(2026, 2, 28, 11);
    const parisNoonAfterChange = Date.UTC(2026, 2, 29, 10);
    const journey: Journey = { start: parisNoonBeforeChange, lapses: [] };
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

  it('splits any duration consistently', () => {
    fc.assert(
      fc.property(duration, (ms) => {
        const display = streakDisplay(ms);
        if (display.unit === 'days') {
          expect(ms).toBeGreaterThanOrEqual(MS_PER_DAY);
          expect(display.days).toBe(Math.floor(ms / MS_PER_DAY));
        } else {
          expect(ms).toBeLessThan(MS_PER_DAY);
          expect(display.hours).toBeLessThanOrEqual(23);
          expect(display.minutes).toBeLessThanOrEqual(59);
          expect(display.hours * 60 + display.minutes).toBe(Math.floor(ms / MS_PER_MINUTE));
        }
      }),
    );
  });
});

describe('properties', () => {
  it('never gives a negative streak or total, whatever the clock says', () => {
    fc.assert(
      fc.property(journeyInput, fc.integer({ min: -days(30), max: days(30) }), (input, shift) => {
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
            valueOf(addLapse(journeyFrom(input), at, input.now)),
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
          const undone = valueOf(removeLapse(valueOf(addLapse(before, at, input.now)), at));
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
        expect(currentStreakMs(journey, now + later)).toBeGreaterThanOrEqual(
          currentStreakMs(journey, now),
        );
        expect(longestStreakMs(journey, now + later)).toBeGreaterThanOrEqual(
          longestStreakMs(journey, now),
        );
        expect(totalCleanDays(journey, now + later)).toBeGreaterThanOrEqual(
          totalCleanDays(journey, now),
        );
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
      }),
    );
  });
});
