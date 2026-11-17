import { QUOTES } from '@/domain/quotes';
import { rankStanding } from '@/domain/ranks';
import { counterSize, type StreakDisplay } from '@/domain/streak';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import type { WeekDayStatus } from '@/domain/week';
import {
  counterParts,
  rankBadgeText,
  spokenCounter,
  spokenQuote,
  spokenWeek,
  weekdayInitial,
} from '@/features/home/labels';
import { createI18n } from '@/lib/i18n';
import { counterFontSizes, sizes, spacing } from '@/ui/theme';
import { journeyOf } from '@test/arbitraries';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;
const NBSP = ' ';

const start = Date.UTC(2026, 0, 1, 8);
const journey = journeyOf(start);
const firstDay = rankStanding(journey, [], start + 7 * MS_PER_HOUR + 40 * MS_PER_MINUTE + 30_000);
const sorcerer = rankStanding(journey, [], start + 47.5 * MS_PER_DAY);
const almostWhiteMage = rankStanding(journey, [], start + 59.5 * MS_PER_DAY);
const freeSoul = rankStanding(journey, [], start + 400 * MS_PER_DAY);

describe('spokenCounter', () => {
  it('names the counter before its value', () => {
    expect(spokenCounter(english, { unit: 'days', days: 12 })).toBe('Current streak, 12 days');
    expect(spokenCounter(french, { unit: 'hours', hours: 7, minutes: 40 })).toBe(
      'Série en cours, 7 heures 40 minutes',
    );
  });
});

describe('counterParts', () => {
  it('shows days as a number over its unit', () => {
    expect(counterParts(french, { unit: 'days', days: 1 })).toEqual({
      number: '1',
      unit: 'jour',
      rest: null,
    });
    expect(counterParts(english, { unit: 'days', days: 12 })).toEqual({
      number: '12',
      unit: 'days',
      rest: null,
    });
  });

  it('shows hours with the minutes on a line of their own', () => {
    expect(counterParts(french, { unit: 'hours', hours: 7, minutes: 40 })).toEqual({
      number: '7',
      unit: 'heures',
      rest: `et 40${NBSP}min`,
    });
    expect(counterParts(english, { unit: 'hours', hours: 1, minutes: 5 })).toEqual({
      number: '1',
      unit: 'hour',
      rest: 'and 5 min',
    });
  });

  it('leaves out the minutes line on the hour', () => {
    expect(counterParts(english, { unit: 'hours', hours: 3, minutes: 0 }).rest).toBeNull();
  });
});

// Advance width in em of the tabular figures of Barlow Condensed SemiBold, read from the hmtx
// table of the bundled font.
const DIGIT_EM = 0.475;

// The widest number of each size: tabular digits all have the same width.
const WIDEST: StreakDisplay[] = [
  { unit: 'days', days: 99 },
  { unit: 'hours', hours: 23, minutes: 59 },
  { unit: 'days', days: 999 },
  { unit: 'days', days: 9999 },
];

// Inside the ring, less its stroke and some air on each side.
const RING_INSIDE = sizes.streakRing - 2 * sizes.streakRingStroke - 2 * spacing.l;

describe('streak counter width', () => {
  it.each(WIDEST)('fits %o inside the ring', (display) => {
    const { number } = counterParts(english, display);
    const fontSize = counterFontSizes[counterSize(display)];
    expect(number.length * DIGIT_EM * fontSize).toBeLessThanOrEqual(RING_INSIDE);
  });
});

describe('rankBadgeText', () => {
  it('shows the first rank locked, with the time left to it, before day one', () => {
    expect(rankBadgeText(french, firstDay)).toMatchObject({
      rank: { id: 'novice' },
      unlocked: false,
      name: 'Premier rang',
      detail: `Novice dans 16${NBSP}h${NBSP}20`,
      spokenLabel: 'Premier rang, Novice dans 16 heures 20 minutes',
    });
    expect(rankBadgeText(english, firstDay).detail).toBe(`Novice in 16${NBSP}h${NBSP}20${NBSP}min`);
  });

  it('shows the current rank and the days left to the next one', () => {
    expect(rankBadgeText(french, sorcerer)).toMatchObject({
      rank: { id: 'sorcerer' },
      unlocked: true,
      name: 'Sorcier',
      detail: 'Mage blanc dans 13 jours',
      spokenLabel: 'Sorcier, Mage blanc dans 13 jours',
    });
    expect(rankBadgeText(french, almostWhiteMage).detail).toBe('Mage blanc dans 1 jour');
    expect(rankBadgeText(english, sorcerer)).toMatchObject({
      name: 'Sorcerer',
      detail: 'White mage in 13 days',
    });
  });

  it('says when every rank is unlocked', () => {
    expect(rankBadgeText(french, freeSoul)).toMatchObject({
      name: 'Âme libre',
      detail: 'Tous les rangs débloqués',
      spokenLabel: 'Âme libre, Tous les rangs débloqués',
    });
  });
});

describe('spokenWeek', () => {
  const day = (status: WeekDayStatus, index: number) => ({ day: index, status });

  it('counts the clean days of the week', () => {
    const week = (['lapse', 'clean', 'clean', 'clean', 'clean', 'clean', 'today'] as const).map(
      day,
    );
    expect(spokenWeek(english, week)).toBe('5 clean days in the last 7');
    expect(spokenWeek(french, week)).toBe('5 jours propres sur les 7 derniers');
  });

  it('follows French plurals, where 0 and 1 are singular', () => {
    const none = Array.from({ length: 7 }, (_, index) => day('lapse', index));
    expect(spokenWeek(french, none)).toBe('0 jour propre sur les 7 derniers');
    expect(spokenWeek(english, none)).toBe('0 clean days in the last 7');
    expect(spokenWeek(english, [day('clean', 0)])).toBe('1 clean day in the last 7');
  });
});

describe('weekdayInitial', () => {
  // Exact letters belong to the platform's locale data; flust decides the weekday.
  it('names the weekday of the local day, whatever the device time zone', () => {
    // 2026-01-19 was a Monday.
    const monday = Date.UTC(2026, 0, 19) / MS_PER_DAY;
    expect(weekdayInitial('en', monday)).toBe('M');
    expect(weekdayInitial('en', monday + 2)).toBe('W');
    expect(weekdayInitial('fr', monday + 2)).toBe('M');
    expect(weekdayInitial('fr', monday + 6)).toBe('D');
  });
});

describe('spokenQuote', () => {
  it('starts with the quote of the day and ends with the author when there is one', () => {
    expect(spokenQuote(french, 'A', 'Sénèque')).toBe('Mot du jour, A, Sénèque');
    expect(spokenQuote(english, 'A', null)).toBe('Quote of the day, A');
  });
});

describe('quotes', () => {
  it.each([
    ['en', english],
    ['fr', french],
  ] as const)('have a text and an author name in %s for every quote', (_, t) => {
    for (const quote of QUOTES) {
      expect(t(`quotes.${quote.id}`, { defaultValue: '' })).not.toBe('');
      if (quote.author)
        expect(t(`quoteAuthors.${quote.author}`, { defaultValue: '' })).not.toBe('');
    }
  });
});
