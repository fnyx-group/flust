import * as fc from 'fast-check';

import { localDayNumber } from '@/domain/local-time';
import { QUOTES, quoteOfTheDay } from '@/domain/quotes';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/time';
import { timestamp } from '@test/arbitraries';
import { fixedOffset, zoneOffsetAt } from '@test/zones';

const paris = zoneOffsetAt('Europe/Paris');
const offsets = fc.integer({ min: -12 * 60, max: 14 * 60 }).map(fixedOffset);

describe('QUOTES', () => {
  it('has 30 distinct quotes', () => {
    expect(new Set(QUOTES.map((quote) => quote.id)).size).toBe(30);
  });

  it('names an author only for the ancient lines', () => {
    const authors = new Set(QUOTES.map((quote) => quote.author));
    expect(authors).toEqual(new Set([null, 'epictetus', 'seneca', 'marcus-aurelius']));
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
