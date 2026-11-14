import * as fc from 'fast-check';

import { removeLapse } from '@/domain/journey';
import {
  canUndo,
  defaultEarlierLapse,
  hasDetails,
  inSupportWindow,
  lapseBounds,
  lapseSummary,
  logLapse,
  NO_DETAILS,
  planToRestore,
  SUPPORT_WINDOW_MS,
  undoDeadline,
  type LapseRecord,
} from '@/domain/lapse';
import { DEFAULT_PLAN, type Plan } from '@/domain/onboarding';
import { RANKS } from '@/domain/ranks';
import { err } from '@/domain/result';
import { totalCleanDays } from '@/domain/streak';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { journeyFrom, journeyInput, journeyOf, rankIds, unwrap } from '@test/arbitraries';
import { zoneOffsetAt } from '@test/zones';

const START = Date.UTC(2026, 0, 1, 8);
const NOW = START + 12 * MS_PER_DAY + 5 * MS_PER_HOUR + 30_500;
const UTC = () => 0;
const PARIS = zoneOffsetAt('Europe/Paris');

function record(recordedAt: number | null, at = START): LapseRecord {
  return { id: 1, at, recordedAt };
}

describe('logLapse', () => {
  it('adds a lapse at now or earlier in the current streak', () => {
    const journey = journeyOf(START, [START + MS_PER_DAY]);
    expect(unwrap(logLapse(journey, NOW, NOW)).lapses).toEqual([START + MS_PER_DAY, NOW]);
    expect(unwrap(logLapse(journey, START + MS_PER_DAY, NOW)).lapses).toHaveLength(2);
  });

  it('refuses a lapse before the last one, in the future or before the start', () => {
    const journey = journeyOf(START, [START + MS_PER_DAY]);
    expect(logLapse(journey, START + MS_PER_DAY - 1, NOW)).toEqual(err('lapse-before-last'));
    expect(logLapse(journey, NOW + 1, NOW)).toEqual(err('lapse-in-future'));
    expect(logLapse(journey, START - 1, NOW)).toEqual(err('lapse-before-start'));
    expect(logLapse(journey, Number.NaN, NOW)).toEqual(err('invalid-timestamp'));
  });

  it('is undone exactly by removing the same lapse, duplicates included', () => {
    fc.assert(
      fc.property(journeyInput, fc.double({ min: 0, max: 1, noNaN: true }), (input, position) => {
        const journey = journeyFrom(input);
        const from = journey.lapses.at(-1) ?? journey.start;
        const at = Math.floor(from + (input.now - from) * position);
        const logged = unwrap(logLapse(journey, at, input.now));
        expect(unwrap(removeLapse(logged, at))).toEqual(journey);
      }),
    );
  });
});

describe('lapseBounds', () => {
  it('goes from the start of the current streak to the current minute', () => {
    expect(lapseBounds(journeyOf(START), NOW)).toEqual({
      min: START,
      max: NOW - 30_500,
    });
    expect(lapseBounds(journeyOf(START, [START + MS_PER_DAY]), NOW)?.min).toBe(START + MS_PER_DAY);
  });

  it('never ends before the streak started, when it started this minute', () => {
    const last = NOW - 10_000;
    expect(lapseBounds(journeyOf(START, [last]), NOW)).toEqual({ min: last, max: last });
  });

  it('allows nothing while the clock is behind the streak start', () => {
    expect(lapseBounds(journeyOf(START, [NOW]), NOW - 1)).toBeNull();
  });

  it('suggests an hour ago, within the streak', () => {
    const bounds = { min: START, max: NOW - 30_500 };
    expect(defaultEarlierLapse(bounds)).toBe(bounds.max - MS_PER_HOUR);
    expect(defaultEarlierLapse({ min: NOW - 10 * MS_PER_MINUTE, max: NOW })).toBe(
      NOW - 10 * MS_PER_MINUTE,
    );
  });
});

describe('lapseSummary', () => {
  it('keeps the total and shows the streak that ended', () => {
    const summary = unwrap(lapseSummary(journeyOf(START), NOW, [], NOW));
    expect(summary.totalCleanDays).toBe(12);
    expect(summary.endedStreak).toEqual({ unit: 'days', days: 12 });
    expect(summary.rank?.id).toBe('initiate');
  });

  it('shows a short streak in hours and minutes', () => {
    const last = NOW - 3 * MS_PER_HOUR - 20 * MS_PER_MINUTE;
    const summary = unwrap(lapseSummary(journeyOf(START, [last]), NOW, [], NOW));
    expect(summary.endedStreak).toEqual({ unit: 'hours', hours: 3, minutes: 20 });
  });

  it('counts a backdated lapse at its chosen time, without lowering the rank', () => {
    const journey = journeyOf(START);
    const at = START + 5 * MS_PER_DAY + MS_PER_HOUR;
    const summary = unwrap(lapseSummary(journey, at, ['novice', 'apprentice', 'initiate'], NOW));
    expect(summary.totalCleanDays).toBe(5 + 7);
    expect(summary.endedStreak).toEqual({ unit: 'days', days: 5 });
    expect(summary.rank?.id).toBe('initiate');
  });

  it('has no rank before the first one', () => {
    const summary = unwrap(lapseSummary(journeyOf(NOW - MS_PER_HOUR), NOW, [], NOW));
    expect(summary.rank).toBeNull();
  });

  it('passes on the reason a lapse time is refused', () => {
    expect(lapseSummary(journeyOf(START), NOW + 1, [], NOW)).toEqual(err('lapse-in-future'));
  });

  it('never shows more clean days than before, nor a lower rank than the stored one', () => {
    fc.assert(
      fc.property(
        journeyInput,
        rankIds,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (input, ranks, position) => {
          const journey = journeyFrom(input);
          const from = journey.lapses.at(-1) ?? journey.start;
          const at = Math.floor(from + (input.now - from) * position);
          const summary = unwrap(lapseSummary(journey, at, ranks, input.now));
          const storedIndex = ranks.length - 1;
          const shownIndex = RANKS.findIndex((rank) => rank.id === summary.rank?.id);
          return (
            summary.totalCleanDays <= totalCleanDays(journey, input.now) &&
            shownIndex >= storedIndex
          );
        },
      ),
    );
  });
});

describe('inSupportWindow', () => {
  it('lasts six hours after the lapse was logged', () => {
    expect(inSupportWindow(record(NOW), NOW)).toBe(true);
    expect(inSupportWindow(record(NOW), NOW + SUPPORT_WINDOW_MS - 1)).toBe(true);
    expect(inSupportWindow(record(NOW), NOW + SUPPORT_WINDOW_MS)).toBe(false);
  });

  it('counts from when it was logged, not from a backdated time', () => {
    expect(inSupportWindow(record(NOW, NOW - 2 * MS_PER_DAY), NOW + MS_PER_HOUR)).toBe(true);
  });

  it('continues when the clock is moved back a little, and ends when it is moved back far', () => {
    expect(inSupportWindow(record(NOW), NOW - MS_PER_HOUR)).toBe(true);
    expect(inSupportWindow(record(NOW), NOW - SUPPORT_WINDOW_MS)).toBe(false);
  });

  it('does not apply without a lapse, or to lapses stored before it existed', () => {
    expect(inSupportWindow(null, NOW)).toBe(false);
    expect(inSupportWindow(record(null), NOW)).toBe(false);
  });
});

describe('undoDeadline', () => {
  it('is the next local midnight', () => {
    const recordedAt = Date.UTC(2026, 2, 10, 9);
    expect(undoDeadline(recordedAt, UTC)).toBe(Date.UTC(2026, 2, 11));
    expect(undoDeadline(recordedAt, PARIS)).toBe(Date.UTC(2026, 2, 10, 23));
  });

  it('is never less than an hour after the lapse was logged', () => {
    expect(undoDeadline(Date.UTC(2026, 2, 10, 23, 30), UTC)).toBe(Date.UTC(2026, 2, 11, 0, 30));
    expect(undoDeadline(Date.UTC(2026, 2, 10, 22, 59), UTC)).toBe(Date.UTC(2026, 2, 11));
    expect(undoDeadline(Date.UTC(2026, 2, 10, 23, 59), UTC)).toBe(Date.UTC(2026, 2, 11, 0, 59));
  });

  it('follows the month and year boundaries', () => {
    expect(undoDeadline(Date.UTC(2026, 1, 28, 9), UTC)).toBe(Date.UTC(2026, 2, 1));
    expect(undoDeadline(Date.UTC(2026, 11, 31, 9), UTC)).toBe(Date.UTC(2027, 0, 1));
  });

  it('uses the local midnight of a night with a clock change', () => {
    // Paris moves from UTC+1 to UTC+2 at 02:00 on 29 March 2026; midnight is still at UTC+1.
    expect(undoDeadline(Date.UTC(2026, 2, 28, 12), PARIS)).toBe(Date.UTC(2026, 2, 28, 23));
    // Back to UTC+1 at 03:00 on 25 October 2026; the next midnight is at UTC+1.
    expect(undoDeadline(Date.UTC(2026, 9, 25, 12), PARIS)).toBe(Date.UTC(2026, 9, 25, 23));
  });

  it('keeps the minimum hour when the next midnight cannot be represented', () => {
    const recordedAt = Date.UTC(9999, 11, 31, 12);
    expect(undoDeadline(recordedAt, UTC)).toBe(recordedAt + MS_PER_HOUR);
  });
});

describe('canUndo', () => {
  const recordedAt = Date.UTC(2026, 2, 10, 9);

  it('allows undoing until the deadline', () => {
    expect(canUndo(record(recordedAt), recordedAt, UTC)).toBe(true);
    expect(canUndo(record(recordedAt), Date.UTC(2026, 2, 11) - 1, UTC)).toBe(true);
    expect(canUndo(record(recordedAt), Date.UTC(2026, 2, 11), UTC)).toBe(false);
  });

  it('does not apply without a lapse, or to lapses stored before it existed', () => {
    expect(canUndo(null, recordedAt, UTC)).toBe(false);
    expect(canUndo(record(null), recordedAt, UTC)).toBe(false);
  });

  it('ends when the clock is moved back further than the window', () => {
    expect(canUndo(record(recordedAt), recordedAt - MS_PER_HOUR, UTC)).toBe(true);
    expect(canUndo(record(recordedAt), recordedAt - MS_PER_DAY, UTC)).toBe(false);
  });
});

describe('planToRestore', () => {
  const walk: Plan = { trigger: 'stress', action: { kind: 'preset', id: 'walk-ten-minutes' } };
  const change = { previous: DEFAULT_PLAN, next: walk };

  it('puts the previous plan back while the plan is still the one the lapse set', () => {
    expect(planToRestore(change, walk)).toEqual(DEFAULT_PLAN);
  });

  it('keeps a plan edited since then', () => {
    expect(planToRestore(change, { ...walk, trigger: 'boredom' })).toBeNull();
  });

  it('does nothing without a plan change or without a plan', () => {
    expect(planToRestore(null, walk)).toBeNull();
    expect(planToRestore(change, null)).toBeNull();
  });
});

describe('hasDetails', () => {
  it('is true once a place or a context is chosen', () => {
    expect(hasDetails(NO_DETAILS)).toBe(false);
    expect(hasDetails({ place: 'bedroom', context: [] })).toBe(true);
    expect(hasDetails({ place: null, context: ['stress'] })).toBe(true);
  });
});
