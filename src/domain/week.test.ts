import * as fc from 'fast-check';

import { localDayNumber, localToUtc } from '@/domain/local-time';
import { MS_PER_HOUR } from '@/domain/time';
import { cleanDayCount, weekStrip, type WeekDayStatus } from '@/domain/week';
import { journeyFrom, journeyInput, journeyOf, unwrap } from '@test/arbitraries';
import { fixedOffset, zoneOffsetAt } from '@test/zones';

const paris = zoneOffsetAt('Europe/Paris');
const newYork = zoneOffsetAt('America/New_York');
const tokyo = zoneOffsetAt('Asia/Tokyo');

function parisTime(month: number, day: number, hour: number, minute = 0): number {
  return unwrap(localToUtc({ year: 2026, month, day, hour, minute }, paris));
}

function statuses(...args: Parameters<typeof weekStrip>): WeekDayStatus[] {
  return weekStrip(...args).map((entry) => entry.status);
}

describe('weekStrip', () => {
  const start = parisTime(1, 1, 22);
  const today = localDayNumber(parisTime(1, 20, 9), paris);

  it('lists the last seven local days, oldest first and today last', () => {
    const days = weekStrip(journeyOf(start), today, paris).map((entry) => entry.day);
    expect(days).toEqual([today - 6, today - 5, today - 4, today - 3, today - 2, today - 1, today]);
  });

  it('shows past days clean and today in progress without a lapse', () => {
    expect(statuses(journeyOf(start), today, paris)).toEqual([
      ...Array<WeekDayStatus>(6).fill('clean'),
      'today',
    ]);
  });

  it('marks the local days of lapses, however many there are', () => {
    const journey = journeyOf(start, [
      parisTime(1, 15, 0, 30),
      parisTime(1, 18, 23, 50),
      parisTime(1, 18, 8),
    ]);
    expect(statuses(journey, today, paris)).toEqual([
      'clean',
      'lapse',
      'clean',
      'clean',
      'lapse',
      'clean',
      'today',
    ]);
  });

  it('marks today as a lapse after a lapse today', () => {
    const journey = journeyOf(start, [parisTime(1, 20, 7)]);
    expect(statuses(journey, today, paris).at(-1)).toBe('lapse');
  });

  it('marks the days before the start apart and counts the day of the start', () => {
    const lateStart = parisTime(1, 17, 23, 30);
    expect(statuses(journeyOf(lateStart), today, paris)).toEqual([
      'before-start',
      'before-start',
      'before-start',
      'clean',
      'clean',
      'clean',
      'today',
    ]);
  });

  it('shows only today in progress on the first day', () => {
    const firstDay = journeyOf(parisTime(1, 20, 8));
    expect(statuses(firstDay, today, paris)).toEqual([
      ...Array<WeekDayStatus>(6).fill('before-start'),
      'today',
    ]);
  });

  it('puts every day before the start when the clock is set before it', () => {
    const future = journeyOf(parisTime(2, 1, 8));
    expect(statuses(future, today, paris)).toEqual(Array<WeekDayStatus>(7).fill('before-start'));
  });

  it('fills the first week day by day, keeping lapses apart from days before the start', () => {
    const journey = journeyOf(parisTime(1, 16, 21), [parisTime(1, 16, 23), parisTime(1, 18, 10)]);
    expect(statuses(journey, today, paris)).toEqual([
      'before-start',
      'before-start',
      'lapse',
      'clean',
      'lapse',
      'clean',
      'today',
    ]);
  });

  it('places lapses on local days across a daylight saving change', () => {
    // Clocks go forward at 02:00 on 29 March 2026 in Paris: that day lasts 23 hours.
    const springToday = localDayNumber(parisTime(3, 31, 12), paris);
    const journey = journeyOf(start, [parisTime(3, 29, 0, 30), parisTime(3, 30, 0, 15)]);
    expect(statuses(journey, springToday, paris)).toEqual([
      'clean',
      'clean',
      'clean',
      'clean',
      'lapse',
      'lapse',
      'today',
    ]);
    // 23:30 on 28 March, still in winter time, belongs to the 28th.
    const beforeChange = journeyOf(start, [parisTime(3, 28, 23, 30)]);
    expect(statuses(beforeChange, springToday, paris).slice(3, 5)).toEqual(['lapse', 'clean']);
  });

  it('places the same lapse on the local day of each time zone', () => {
    // 03:00 UTC is 22:00 the day before in New York, and noon in Tokyo.
    const lapse = Date.UTC(2026, 0, 15, 3);
    const journey = journeyOf(Date.UTC(2025, 11, 1), [lapse]);
    const utcToday = localDayNumber(Date.UTC(2026, 0, 17, 12), fixedOffset(0));
    const at = (offsetAt: typeof paris) => statuses(journey, utcToday, offsetAt).indexOf('lapse');
    expect(at(tokyo)).toBe(4);
    expect(at(paris)).toBe(4);
    expect(at(newYork)).toBe(3);
  });

  it('always ends on today with seven consecutive days', () => {
    fc.assert(
      fc.property(
        journeyInput,
        fc.integer({ min: -12 * 60, max: 14 * 60 }),
        ({ start: begin, lapses, now }, offset) => {
          const offsetAt = fixedOffset(offset);
          const day = localDayNumber(now, offsetAt);
          const week = weekStrip(journeyFrom({ start: begin, lapses, now }), day, offsetAt);
          return (
            week.length === 7 &&
            week.every((entry, index) => entry.day === day - 6 + index) &&
            week.slice(0, -1).every((entry) => entry.status !== 'today')
          );
        },
      ),
    );
  });

  it('puts every day before the start first, and only those', () => {
    fc.assert(
      fc.property(journeyInput, (input) => {
        const firstDay = localDayNumber(input.start, paris);
        const day = localDayNumber(input.now, paris);
        return weekStrip(journeyFrom(input), day, paris).every(
          (entry) => (entry.status === 'before-start') === entry.day < firstDay,
        );
      }),
    );
  });

  it('never shows a lapse day as clean', () => {
    fc.assert(
      fc.property(journeyInput, (input) => {
        const day = localDayNumber(input.now, paris);
        const lapseDays = new Set(input.lapses.map((lapse) => localDayNumber(lapse, paris)));
        return weekStrip(journeyFrom(input), day, paris).every(
          (entry) => !lapseDays.has(entry.day) || entry.status === 'lapse',
        );
      }),
    );
  });
});

describe('cleanDayCount', () => {
  it('counts clean past days, not today', () => {
    const now = Date.UTC(2026, 0, 20, 12);
    const journey = journeyOf(Date.UTC(2026, 0, 1), [now - 3 * 24 * MS_PER_HOUR]);
    const week = weekStrip(journey, localDayNumber(now, paris), paris);
    expect(cleanDayCount(week)).toBe(5);
  });
});
