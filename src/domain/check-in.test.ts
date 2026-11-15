import * as fc from 'fast-check';

import {
  CHECK_IN_NOTE_MAX_LENGTH,
  hasLowMoodRun,
  isMood,
  isUrgeLevel,
  lowMoodWindowStart,
  MOODS,
  parseCheckIn,
  parseCheckInNote,
  showLowMoodCard,
  todaysCheckIn,
  URGE_LEVELS,
  withCheckIn,
  type CheckIn,
  type Mood,
  type StoredCheckIn,
} from '@/domain/check-in';
import { err, ok } from '@/domain/result';

const TODAY = 20_000;
const AT = Date.UTC(2026, 10, 14, 21);

function checkIn(day: number, mood: Mood, overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    day,
    mood,
    urge: 'none',
    context: [],
    note: null,
    recordedAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

const stored: StoredCheckIn = {
  day: TODAY,
  recordedAt: AT,
  updatedAt: AT + 1000,
  mood: 4,
  urge: 'light',
  context: ['stress', 'in-bed-at-night'],
  note: 'A long day.',
};

describe('moods and urge levels', () => {
  it('recognize their own values only', () => {
    expect(MOODS.every(isMood)).toBe(true);
    expect(URGE_LEVELS.every(isUrgeLevel)).toBe(true);
    for (const value of [0, 6, 2.5, '3', null]) expect(isMood(value)).toBe(false);
    for (const value of ['', 'high', 1, null]) expect(isUrgeLevel(value)).toBe(false);
  });
});

describe('parseCheckInNote', () => {
  it('trims the note and keeps its line breaks', () => {
    expect(parseCheckInNote('  first line\nsecond line \n')).toEqual(ok('first line\nsecond line'));
  });

  it('reads an empty note as no note', () => {
    expect(parseCheckInNote('')).toEqual(ok(null));
    expect(parseCheckInNote(' \n\t ')).toEqual(ok(null));
  });

  it('counts the length in code points', () => {
    expect(parseCheckInNote('😀'.repeat(CHECK_IN_NOTE_MAX_LENGTH)).ok).toBe(true);
    expect(parseCheckInNote('a'.repeat(CHECK_IN_NOTE_MAX_LENGTH + 1))).toEqual(err('too-long'));
  });
});

describe('parseCheckIn', () => {
  it('reads a valid check-in', () => {
    expect(parseCheckIn(stored)).toEqual(
      ok({
        day: TODAY,
        recordedAt: AT,
        updatedAt: AT + 1000,
        mood: 4,
        urge: 'light',
        context: ['stress', 'in-bed-at-night'],
        note: 'A long day.',
      }),
    );
  });

  it('reads a check-in without a note or a context', () => {
    expect(parseCheckIn({ ...stored, note: null, context: [] })).toEqual(
      ok(expect.objectContaining({ note: null, context: [] })),
    );
  });

  it.each<[string, Partial<StoredCheckIn>]>([
    ['a day that is not a whole number', { day: 1.5 }],
    ['a missing day', { day: null }],
    ['an invalid time of recording', { recordedAt: -1 }],
    ['an invalid time of update', { updatedAt: 'now' }],
    ['a mood out of range', { mood: 6 }],
    ['an unknown urge level', { urge: 'extreme' }],
    ['a context that is not a list', { context: 'stress' }],
    ['an unknown context id', { context: ['stress', 'unknown'] }],
    ['a repeated context id', { context: ['stress', 'stress'] }],
    ['a note that is not text', { note: 3 }],
    ['a note that is too long', { note: 'a'.repeat(CHECK_IN_NOTE_MAX_LENGTH + 1) }],
  ])('refuses %s', (_, change) => {
    expect(parseCheckIn({ ...stored, ...change })).toEqual(err('invalid-check-in'));
  });
});

describe('todaysCheckIn', () => {
  it('finds the check-in stored for today, whatever its time of recording', () => {
    const today = checkIn(TODAY, 3, { recordedAt: 0 });
    expect(todaysCheckIn([checkIn(TODAY - 1, 4), today], TODAY)).toBe(today);
    expect(todaysCheckIn([checkIn(TODAY - 1, 4)], TODAY)).toBeNull();
  });
});

describe('withCheckIn', () => {
  it('replaces the check-in of the same day and keeps the latest day first', () => {
    const edited = checkIn(TODAY - 1, 5);
    expect(
      withCheckIn([checkIn(TODAY, 3), checkIn(TODAY - 1, 1), checkIn(TODAY - 3, 2)], edited),
    ).toEqual([checkIn(TODAY, 3), edited, checkIn(TODAY - 3, 2)]);
  });

  it('adds a new day in order', () => {
    expect(withCheckIn([checkIn(TODAY - 2, 3)], checkIn(TODAY, 1))).toEqual([
      checkIn(TODAY, 1),
      checkIn(TODAY - 2, 3),
    ]);
  });
});

describe('hasLowMoodRun', () => {
  function run(...moods: [number, Mood][]): CheckIn[] {
    return moods.map(([daysAgo, mood]) => checkIn(TODAY - daysAgo, mood));
  }

  it('needs three check-ins', () => {
    expect(hasLowMoodRun([], TODAY)).toBe(false);
    expect(hasLowMoodRun(run([0, 1]), TODAY)).toBe(false);
    expect(hasLowMoodRun(run([0, 1], [1, 1]), TODAY)).toBe(false);
  });

  it('shows when the three latest moods are 1 or 2', () => {
    expect(hasLowMoodRun(run([0, 1], [1, 2], [2, 2]), TODAY)).toBe(true);
    expect(hasLowMoodRun(run([0, 2], [1, 2], [2, 3]), TODAY)).toBe(false);
  });

  it('only counts the three latest check-ins', () => {
    expect(hasLowMoodRun(run([3, 4], [2, 1], [1, 1], [0, 1]), TODAY)).toBe(true);
    expect(hasLowMoodRun(run([3, 1], [2, 1], [1, 1], [0, 4]), TODAY)).toBe(false);
  });

  it('orders check-ins by day, not by input order or time of recording', () => {
    const late = checkIn(TODAY - 3, 5, { recordedAt: AT + 10_000, updatedAt: AT + 10_000 });
    expect(hasLowMoodRun([checkIn(TODAY - 2, 1), late, ...run([0, 1], [1, 2])], TODAY)).toBe(true);
  });

  it('keeps the run across missed days', () => {
    expect(hasLowMoodRun(run([0, 1], [5, 2], [9, 1]), TODAY)).toBe(true);
  });

  it('only counts the last 14 local days, today included', () => {
    expect(lowMoodWindowStart(TODAY)).toBe(TODAY - 13);
    expect(hasLowMoodRun(run([0, 1], [5, 2], [13, 1]), TODAY)).toBe(true);
    expect(hasLowMoodRun(run([0, 1], [5, 2], [14, 1]), TODAY)).toBe(false);
    expect(hasLowMoodRun(run([0, 1], [5, 2], [14, 1]), TODAY - 1)).toBe(false);
  });

  it('ignores check-ins after today, left by a clock set back', () => {
    expect(hasLowMoodRun(run([-1, 5], [0, 1], [1, 1], [2, 1]), TODAY)).toBe(true);
    expect(hasLowMoodRun(run([-1, 1], [0, 1], [1, 1]), TODAY)).toBe(false);
  });

  it('stops once today’s mood is edited up', () => {
    const before = run([0, 1], [1, 1], [2, 1]);
    expect(hasLowMoodRun(before, TODAY)).toBe(true);
    expect(hasLowMoodRun(withCheckIn(before, checkIn(TODAY, 4)), TODAY)).toBe(false);
  });

  it('is true exactly when the three latest days of the window are all 1 or 2', () => {
    const entries = fc.uniqueArray(
      fc.record({
        daysAgo: fc.integer({ min: -3, max: 30 }),
        mood: fc.constantFrom(...MOODS),
      }),
      { selector: (entry) => entry.daysAgo, maxLength: 20 },
    );
    fc.assert(
      fc.property(entries, (list) => {
        const latest = list
          .filter((entry) => entry.daysAgo >= 0 && entry.daysAgo <= 13)
          .sort((a, b) => a.daysAgo - b.daysAgo)
          .slice(0, 3);
        const expected = latest.length === 3 && latest.every((entry) => entry.mood <= 2);
        const checkIns = list.map((entry) => checkIn(TODAY - entry.daysAgo, entry.mood));
        expect(hasLowMoodRun(checkIns, TODAY)).toBe(expected);
      }),
    );
  });
});

describe('showLowMoodCard', () => {
  const low = [checkIn(TODAY, 1), checkIn(TODAY - 1, 1), checkIn(TODAY - 2, 2)];

  it('stays hidden for the day it was closed', () => {
    expect(showLowMoodCard(low, TODAY, TODAY)).toBe(false);
  });

  it('comes back on the next local day', () => {
    expect(showLowMoodCard(low, TODAY, TODAY - 1)).toBe(true);
    expect(showLowMoodCard(low, TODAY, null)).toBe(true);
  });

  it('never shows without a low mood run', () => {
    expect(showLowMoodCard(low.slice(0, 2), TODAY, null)).toBe(false);
  });
});
