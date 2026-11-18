import { QUOTES } from '@/domain/quotes';
import { rankStanding } from '@/domain/ranks';
import { counterSize, type StreakDisplay } from '@/domain/streak';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { counterParts, rankLineText, spokenCounter, spokenQuote } from '@/features/home/labels';
import { HOME_RING_MIN } from '@/features/home/home-fit';
import { createI18n } from '@/lib/i18n';
import { counterFontSize, sizes, spacing, streakRingSize, typography } from '@/ui/theme';
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

// The smallest ring the home screen uses, one between, and the boards' size.
const RING_SIZES = [HOME_RING_MIN, 240, sizes.streakRing];

describe('streak counter width', () => {
  it.each(RING_SIZES.flatMap((ring) => WIDEST.map((display) => [ring, display] as const)))(
    'fits in a %d point ring %o',
    (ring, display) => {
      const { number } = counterParts(english, display);
      const fontSize = counterFontSize(ring, counterSize(display));
      // Inside the ring, less its stroke and some air on each side.
      const inside = ring - 2 * sizes.streakRingStroke - 2 * spacing.l;
      expect(number.length * DIGIT_EM * fontSize).toBeLessThanOrEqual(inside);
    },
  );

  // The number, its unit and the minutes are stacked in the middle of the ring.
  it.each(RING_SIZES.flatMap((ring) => WIDEST.map((display) => [ring, display] as const)))(
    'stacks its lines inside a %d point ring %o',
    (ring, display) => {
      const { rest } = counterParts(english, display);
      const height =
        counterFontSize(ring, counterSize(display)) +
        typography.streakUnit.lineHeight +
        (rest === null ? 0 : typography.streakRest.lineHeight);
      expect(height).toBeLessThanOrEqual(ring - 2 * sizes.streakRingStroke - 2 * spacing.xs);
    },
  );

  it('keeps the boards size and the counter sizes from 390 points wide', () => {
    expect(streakRingSize(390)).toBe(sizes.streakRing);
    expect(streakRingSize(430)).toBe(sizes.streakRing);
    expect(streakRingSize(320)).toBeLessThan(sizes.streakRing);
    expect(counterFontSize(sizes.streakRing, 'large')).toBe(150);
    expect(counterFontSize(sizes.streakRing, 'medium')).toBe(130);
    expect(counterFontSize(sizes.streakRing, 'small')).toBe(100);
  });
});

describe('rankLineText', () => {
  it('shows the first rank locked, with the time left to it, before day one', () => {
    expect(rankLineText(french, firstDay)).toMatchObject({
      rank: { id: 'novice' },
      unlocked: false,
      name: 'Premier rang',
      detail: `Novice dans 16${NBSP}h${NBSP}20`,
      spokenLabel: 'Premier rang, Novice dans 16 heures 20 minutes',
    });
    expect(rankLineText(english, firstDay).detail).toBe(`Novice in 16${NBSP}h${NBSP}20`);
  });

  it('shows the current rank and the days left to the next one', () => {
    expect(rankLineText(french, sorcerer)).toMatchObject({
      rank: { id: 'sorcerer' },
      unlocked: true,
      name: 'Sorcier',
      detail: 'Mage blanc dans 13 jours',
      spokenLabel: 'Sorcier, Mage blanc dans 13 jours',
    });
    expect(rankLineText(french, almostWhiteMage).detail).toBe('Mage blanc dans 1 jour');
    expect(rankLineText(english, sorcerer)).toMatchObject({
      name: 'Sorcerer',
      detail: 'White mage in 13 days',
    });
  });

  it('says when every rank is unlocked', () => {
    expect(rankLineText(french, freeSoul)).toMatchObject({
      name: 'Âme libre',
      detail: 'Tous les rangs débloqués',
      spokenLabel: 'Âme libre, Tous les rangs débloqués',
    });
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
