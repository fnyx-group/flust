import * as fc from 'fast-check';

import { localDayNumber, localToUtc, utcToLocal } from '@/domain/local-time';
import { QUOTES, quoteOfTheDay } from '@/domain/quotes';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { timestamp, unwrap } from '@test/arbitraries';
import { fixedOffset, zoneOffsetAt } from '@test/zones';

const paris = zoneOffsetAt('Europe/Paris');
const offsets = fc.integer({ min: -12 * 60, max: 14 * 60 }).map(fixedOffset);

describe('QUOTES', () => {
  it('has 30 distinct quotes', () => {
    expect(new Set(QUOTES.map((quote) => quote.id)).size).toBe(30);
  });

  // The order of docs/product/quotes.md: ancient, original, ancient, ancient, original, with the
  // ancient authors taking turns.
  it('follows the documented order of authors', () => {
    const E = 'epictetus';
    const S = 'seneca';
    const M = 'marcus-aurelius';
    const O = null;
    expect(QUOTES.map((quote) => quote.author)).toEqual(
      Array.from({ length: 6 }, () => [E, O, S, M, O]).flat(),
    );
  });
});

describe('quoteOfTheDay', () => {
  // 10:00 in Paris, in winter.
  const start = Date.UTC(2026, 0, 10, 9);

  it('opens every journey on the first quote', () => {
    expect(quoteOfTheDay(start, start, paris)).toBe(QUOTES[0]);
  });

  it('changes at local midnight', () => {
    const midnight = Date.UTC(2026, 0, 10, 23);
    expect(quoteOfTheDay(start, midnight - 1, paris)).toBe(QUOTES[0]);
    expect(quoteOfTheDay(start, midnight, paris)).toBe(QUOTES[1]);
  });

  it('repeats only after all 30 quotes', () => {
    expect(quoteOfTheDay(start, start + 29 * MS_PER_DAY, paris)).toBe(QUOTES[29]);
    expect(quoteOfTheDay(start, start + 30 * MS_PER_DAY, paris)).toBe(QUOTES[0]);
  });

  it('still shows a quote when the clock is before the start', () => {
    expect(quoteOfTheDay(start, start - MS_PER_DAY, paris)).toBe(QUOTES[29]);
  });

  it('counts local days across a daylight saving change', () => {
    // Local midnight on 1 July in Paris, in summer time, 172 days after a winter start.
    const summerMidnight = Date.UTC(2026, 5, 30, 22);
    expect(quoteOfTheDay(start, summerMidnight - 1, paris)).toBe(QUOTES[21]);
    expect(quoteOfTheDay(start, summerMidnight, paris)).toBe(QUOTES[22]);
  });

  it('is the same from midnight to the end of the day in a zone with daylight saving', () => {
    fc.assert(
      fc.property(timestamp, timestamp, (begin, now) => {
        const { year, month, day } = utcToLocal(now, paris);
        const midnight = unwrap(localToUtc({ year, month, day, hour: 0, minute: 0 }, paris));
        const lastMinute = unwrap(localToUtc({ year, month, day, hour: 23, minute: 59 }, paris));
        const quote = quoteOfTheDay(begin, midnight, paris);
        return (
          quoteOfTheDay(begin, now, paris) === quote &&
          quoteOfTheDay(begin, lastMinute + MS_PER_MINUTE - 1, paris) === quote
        );
      }),
    );
  });

  it('is the same all day', () => {
    fc.assert(
      fc.property(timestamp, timestamp, offsets, fc.nat(23), (begin, now, offsetAt, hours) => {
        const dayStart = localDayNumber(now, offsetAt) * MS_PER_DAY - offsetAt(now) * 60_000;
        const later = dayStart + hours * MS_PER_HOUR;
        return quoteOfTheDay(begin, dayStart, offsetAt) === quoteOfTheDay(begin, later, offsetAt);
      }),
    );
  });

  it('shows 30 different quotes over any 30 consecutive days', () => {
    fc.assert(
      fc.property(timestamp, timestamp, offsets, (begin, now, offsetAt) => {
        const days = Array.from({ length: 30 }, (_, day) =>
          quoteOfTheDay(begin, now + day * MS_PER_DAY, offsetAt),
        );
        return new Set(days).size === 30;
      }),
    );
  });
});
