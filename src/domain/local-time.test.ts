import * as fc from 'fast-check';

import {
  addMonths,
  daysInMonth,
  localToUtc,
  monthGrid,
  utcToLocal,
  type LocalDateTime,
  type UtcOffsetAt,
} from '@/domain/local-time';
import { err, ok } from '@/domain/result';
import { MS_PER_DAY, MS_PER_MINUTE } from '@/domain/time';
import { fixedOffset, zoneOffsetAt } from '@test/zones';

function local(year: number, month: number, day: number, hour = 0, minute = 0): LocalDateTime {
  return { year, month, day, hour, minute };
}

const paris = zoneOffsetAt('Europe/Paris');
const newYork = zoneOffsetAt('America/New_York');
const sydney = zoneOffsetAt('Australia/Sydney');
const lordHowe = zoneOffsetAt('Australia/Lord_Howe');
const santiago = zoneOffsetAt('America/Santiago');
const havana = zoneOffsetAt('America/Havana');

// Instants where the offset grows, found day by day and then to the minute.
function forwardTransitions(offsetAt: UtcOffsetAt, from: number, to: number) {
  const found: { at: number; before: number; after: number }[] = [];
  for (let day = from; day < to; day += MS_PER_DAY) {
    const before = offsetAt(day);
    const after = offsetAt(day + MS_PER_DAY);
    if (after <= before) continue;
    let low = day;
    let high = day + MS_PER_DAY;
    while (high - low > MS_PER_MINUTE) {
      const middle = Math.floor((low + high) / 2 / MS_PER_MINUTE) * MS_PER_MINUTE;
      if (offsetAt(middle) === before) low = middle;
      else high = middle;
    }
    found.push({ at: high, before, after });
  }
  return found;
}

describe('localToUtc', () => {
  it.each([
    ['UTC', 0, Date.UTC(2026, 5, 15, 12, 0)],
    ['Kathmandu, +05:45', 345, Date.UTC(2026, 5, 15, 6, 15)],
    ["St John's, -03:30", -210, Date.UTC(2026, 5, 15, 15, 30)],
    ['Kiritimati, +14:00', 840, Date.UTC(2026, 5, 14, 22, 0)],
    ['Baker Island, -12:00', -720, Date.UTC(2026, 5, 16, 0, 0)],
  ])('converts noon with a fixed offset: %s', (_, offset, expected) => {
    expect(localToUtc(local(2026, 6, 15, 12), fixedOffset(offset))).toEqual(ok(expected));
  });

  it('uses the summer offset in summer and the winter offset in winter', () => {
    expect(localToUtc(local(2026, 7, 1, 12), paris)).toEqual(ok(Date.UTC(2026, 6, 1, 10)));
    expect(localToUtc(local(2026, 1, 1, 12), paris)).toEqual(ok(Date.UTC(2026, 0, 1, 11)));
  });

  describe('when clocks go forward and a wall time is skipped', () => {
    it('moves a skipped time forward by the length of the gap', () => {
      // Paris skips from 02:00 to 03:00 on 29 March 2026: 02:30 does not exist.
      const skipped = localToUtc(local(2026, 3, 29, 2, 30), paris);
      expect(skipped).toEqual(ok(Date.UTC(2026, 2, 29, 1, 30)));
      expect(skipped.ok && utcToLocal(skipped.value, paris)).toEqual(local(2026, 3, 29, 3, 30));
    });

    it('keeps the times on either side of the gap', () => {
      expect(localToUtc(local(2026, 3, 29, 1, 59), paris)).toEqual(
        ok(Date.UTC(2026, 2, 29, 0, 59)),
      );
      expect(localToUtc(local(2026, 3, 29, 3, 0), paris)).toEqual(ok(Date.UTC(2026, 2, 29, 1, 0)));
    });

    it('handles New York, which changes at a different date and hour', () => {
      expect(localToUtc(local(2026, 3, 8, 2, 30), newYork)).toEqual(
        ok(Date.UTC(2026, 2, 8, 7, 30)),
      );
    });

    it('handles a half-hour gap on Lord Howe Island', () => {
      // Lord Howe goes from 02:00 +10:30 to 02:30 +11:00 on 4 October 2026.
      expect(localToUtc(local(2026, 10, 4, 2, 15), lordHowe)).toEqual(
        ok(Date.UTC(2026, 9, 3, 15, 45)),
      );
    });

    it('moves a skipped midnight forward, as in Santiago', () => {
      // Santiago goes from 24:00 -04:00 to 01:00 -03:00 on 6 September 2026: 00:00 does not exist.
      const midnight = localToUtc(local(2026, 9, 6, 0, 0), santiago);
      expect(midnight).toEqual(ok(Date.UTC(2026, 8, 6, 4, 0)));
      expect(midnight.ok && utcToLocal(midnight.value, santiago)).toEqual(local(2026, 9, 6, 1, 0));
    });

    it('handles the southern hemisphere, where summer time starts in October', () => {
      expect(localToUtc(local(2026, 10, 4, 2, 30), sydney)).toEqual(
        ok(Date.UTC(2026, 9, 3, 16, 30)),
      );
    });
  });

  describe('when clocks go back and a wall time happens twice', () => {
    it('picks the first occurrence', () => {
      // Paris repeats 02:00 to 03:00 on 25 October 2026, first at +02:00, then at +01:00.
      expect(localToUtc(local(2026, 10, 25, 2, 30), paris)).toEqual(
        ok(Date.UTC(2026, 9, 25, 0, 30)),
      );
      expect(localToUtc(local(2026, 11, 1, 1, 30), newYork)).toEqual(
        ok(Date.UTC(2026, 10, 1, 5, 30)),
      );
      expect(localToUtc(local(2026, 4, 5, 2, 30), sydney)).toEqual(
        ok(Date.UTC(2026, 3, 4, 15, 30)),
      );
    });

    it('keeps the hour after the repeated one', () => {
      expect(localToUtc(local(2026, 10, 25, 3, 0), paris)).toEqual(ok(Date.UTC(2026, 9, 25, 2, 0)));
    });
  });

  it('accepts 29 February in a leap year only', () => {
    expect(localToUtc(local(2028, 2, 29, 12), fixedOffset(0))).toEqual(
      ok(Date.UTC(2028, 1, 29, 12)),
    );
    expect(localToUtc(local(2027, 2, 29, 12), fixedOffset(0))).toEqual(
      err('invalid-local-date-time'),
    );
  });

  it.each([
    ['month 0', local(2026, 0, 1)],
    ['month 13', local(2026, 13, 1)],
    ['day 0', local(2026, 1, 0)],
    ['31 April', local(2026, 4, 31)],
    ['hour 24', local(2026, 1, 1, 24)],
    ['hour -1', local(2026, 1, 1, -1)],
    ['minute 60', local(2026, 1, 1, 0, 60)],
    ['a fractional minute', local(2026, 1, 1, 0, 1.5)],
    ['year 1969', local(1969, 12, 31)],
    ['year 10000', local(10000, 1, 1)],
  ])('refuses %s', (_, value) => {
    expect(localToUtc(value, fixedOffset(0))).toEqual(err('invalid-local-date-time'));
  });

  it('refuses a time that would fall before 1970 in UTC', () => {
    expect(localToUtc(local(1970, 1, 1, 0, 30), fixedOffset(60))).toEqual(
      err('invalid-local-date-time'),
    );
  });

  describe('round trips', () => {
    const zones = fc.constantFrom(
      paris,
      newYork,
      sydney,
      lordHowe,
      zoneOffsetAt('Asia/Kathmandu'),
      zoneOffsetAt('America/St_Johns'),
      zoneOffsetAt('Pacific/Kiritimati'),
      zoneOffsetAt('Europe/London'),
      santiago,
      havana,
    );
    const minute = fc
      .integer({ min: Date.UTC(2020, 0, 1) / 60_000, max: Date.UTC(2030, 0, 1) / 60_000 })
      .map((minutes) => minutes * 60_000);

    it('moves every skipped wall time forward by the length of the gap', () => {
      const zonesWithGaps = { paris, newYork, sydney, lordHowe, santiago, havana };
      for (const offsetAt of Object.values(zonesWithGaps)) {
        const gaps = forwardTransitions(offsetAt, Date.UTC(2024, 0, 1), Date.UTC(2029, 0, 1));
        expect(gaps.length).toBeGreaterThanOrEqual(5);
        for (const { at, before, after } of gaps) {
          const firstSkipped = at + before * MS_PER_MINUTE;
          const end = at + after * MS_PER_MINUTE;
          for (let wall = firstSkipped; wall < end; wall += 15 * MS_PER_MINUTE) {
            const result = localToUtc(utcToLocal(wall, fixedOffset(0)), offsetAt);
            expect(result).toEqual(ok(wall - before * MS_PER_MINUTE));
            expect(result.ok && utcToLocal(result.value, offsetAt)).toEqual(
              utcToLocal(wall + (after - before) * MS_PER_MINUTE, fixedOffset(0)),
            );
          }
        }
      }
    });

    it('finds the same instant again, or its first occurrence when the time repeats', () => {
      fc.assert(
        fc.property(zones, minute, (offsetAt, utc) => {
          const result = localToUtc(utcToLocal(utc, offsetAt), offsetAt);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.value).toBeLessThanOrEqual(utc);
          expect(utcToLocal(result.value, offsetAt)).toEqual(utcToLocal(utc, offsetAt));
        }),
      );
    });
  });
});

describe('utcToLocal', () => {
  it('reads the wall time in the given zone', () => {
    expect(utcToLocal(Date.UTC(2026, 0, 1, 23, 30), fixedOffset(60))).toEqual(
      local(2026, 1, 2, 0, 30),
    );
    expect(utcToLocal(Date.UTC(2026, 0, 1, 0, 30), fixedOffset(-60))).toEqual(
      local(2025, 12, 31, 23, 30),
    );
  });
});

describe('daysInMonth', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });
});

describe('monthGrid', () => {
  it('starts weeks on Monday', () => {
    // 1 November 2026 is a Sunday.
    const grid = monthGrid(2026, 11, 2);
    expect(grid.slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    expect(grid.length % 7).toBe(0);
    expect(grid.filter((day) => day !== null)).toHaveLength(30);
  });

  it('starts weeks on Sunday', () => {
    const grid = monthGrid(2026, 11, 1);
    expect(grid.slice(0, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(grid.at(-1)).toBeNull();
    expect(grid.length).toBe(35);
  });

  it('fits February of a non-leap year starting on the first weekday in four rows', () => {
    // 1 February 2027 is a Monday.
    expect(monthGrid(2027, 2, 2)).toHaveLength(28);
  });
});

describe('addMonths', () => {
  it('moves across years in both directions', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 5 }, -17)).toEqual({ year: 2024, month: 12 });
  });
});
