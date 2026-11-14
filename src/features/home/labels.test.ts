import type { TFunction } from 'i18next';

import { QUOTES } from '@/domain/quotes';
import { rankStanding } from '@/domain/ranks';
import { counterSize, type StreakDisplay } from '@/domain/streak';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { counterParts, rankCardText, spokenCounter, spokenStreak } from '@/features/home/labels';
import { createI18n } from '@/lib/i18n';
import { counterFontSizes, sizes, spacing, typography } from '@/ui/theme';
import { journeyOf } from '@test/arbitraries';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;
const NBSP = ' ';

const start = Date.UTC(2026, 0, 1, 8);
const journey = journeyOf(start);
const firstDay = rankStanding(journey, [], start + 7 * MS_PER_HOUR + 40 * MS_PER_MINUTE + 30_000);
const sorcerer = rankStanding(journey, [], start + 47.5 * MS_PER_DAY);
const freeSoul = rankStanding(journey, [], start + 400 * MS_PER_DAY);

describe('spokenStreak', () => {
  it('reads the counter in full words', () => {
    expect(spokenStreak(english, { unit: 'days', days: 12 })).toBe('12 days');
    expect(spokenStreak(english, { unit: 'days', days: 1 })).toBe('1 day');
    expect(spokenStreak(english, { unit: 'hours', hours: 7, minutes: 40 })).toBe(
      '7 hours 40 minutes',
    );
    expect(spokenStreak(english, { unit: 'hours', hours: 1, minutes: 1 })).toBe('1 hour 1 minute');
  });

  it('follows French plurals, where 0 and 1 are singular', () => {
    expect(spokenStreak(french, { unit: 'hours', hours: 1, minutes: 1 })).toBe('1 heure 1 minute');
    expect(spokenStreak(french, { unit: 'hours', hours: 0, minutes: 0 })).toBe('0 minute');
    expect(spokenStreak(french, { unit: 'hours', hours: 7, minutes: 40 })).toBe(
      '7 heures 40 minutes',
    );
  });

  it('leaves out the hours during the first hour, and the minutes on the hour', () => {
    expect(spokenStreak(english, { unit: 'hours', hours: 0, minutes: 5 })).toBe('5 minutes');
    expect(spokenStreak(english, { unit: 'hours', hours: 1, minutes: 0 })).toBe('1 hour');
    expect(spokenStreak(french, { unit: 'hours', hours: 3, minutes: 0 })).toBe('3 heures');
  });
});

describe('spokenCounter', () => {
  it('names the counter before its value', () => {
    expect(spokenCounter(english, { unit: 'days', days: 12 })).toBe('Current streak: 12 days');
    expect(spokenCounter(french, { unit: 'hours', hours: 7, minutes: 40 })).toBe(
      `Série en cours${NBSP}: 7 heures 40 minutes`,
    );
  });
});

describe('counterParts', () => {
  it('splits the counter into numbers and units, with minutes on two digits', () => {
    expect(counterParts(french, { unit: 'hours', hours: 7, minutes: 5 })).toEqual([
      { kind: 'number', text: '7' },
      { kind: 'unit', text: ' h ' },
      { kind: 'number', text: '05' },
      { kind: 'unit', text: ' min' },
    ]);
    expect(counterParts(french, { unit: 'days', days: 1 })).toEqual([
      { kind: 'number', text: '1' },
      { kind: 'unit', text: ' jour' },
    ]);
  });
});

// Advance widths in em, read from the hmtx tables of the bundled fonts: the tabular figures of
// Barlow Condensed SemiBold, and the unit characters of Manrope SemiBold.
const DIGIT_EM = 0.475;
const UNIT_CHAR_EM: Readonly<Record<string, number>> = {
  ' ': 0.2,
  a: 0.5695,
  d: 0.6085,
  h: 0.615,
  i: 0.2645,
  j: 0.2755,
  m: 0.882,
  n: 0.615,
  o: 0.6095,
  r: 0.3865,
  s: 0.536,
  u: 0.615,
  y: 0.5485,
};

function unitEm(text: string): number {
  return [...text].reduce((total, char) => {
    const em = UNIT_CHAR_EM[char];
    if (em === undefined) throw new Error(`No width measured for "${char}"; add it from the font.`);
    return total + em;
  }, 0);
}

function counterWidth(t: TFunction, display: StreakDisplay): number {
  const fontSize = counterFontSizes[counterSize(display)];
  return counterParts(t, display).reduce(
    (width, part) =>
      width +
      (part.kind === 'number'
        ? part.text.length * DIGIT_EM * fontSize
        : unitEm(part.text) * typography.streakUnit.fontSize),
    0,
  );
}

// The widest counter of each size: tabular digits all have the same width.
const WIDEST: StreakDisplay[] = [
  { unit: 'days', days: 99 },
  { unit: 'days', days: 999 },
  { unit: 'hours', hours: 9, minutes: 59 },
  { unit: 'days', days: 9999 },
  { unit: 'hours', hours: 23, minutes: 59 },
];

describe.each([
  ['en', english],
  ['fr', french],
] as const)('streak counter width in %s', (_, t) => {
  it.each(WIDEST)('fits %o on one line at the design width', (display) => {
    expect(counterWidth(t, display)).toBeLessThanOrEqual(
      sizes.counterDesignWidth - 2 * spacing.screen,
    );
  });
});

describe('rankCardText', () => {
  it('shows the first rank locked, with the time left to it, before day one', () => {
    expect(rankCardText(french, firstDay)).toMatchObject({
      rank: { id: 'novice' },
      unlocked: false,
      eyebrow: 'Premier rang',
      name: 'Novice',
      progress: `Débloqué dans 16${NBSP}h${NBSP}20`,
      target: '1 jour',
      spokenLabel: 'Novice, Premier rang, Débloqué dans 16 heures 20 minutes, 1 jour',
    });
    expect(rankCardText(english, firstDay).progress).toBe(
      `Unlocks in 16${NBSP}h${NBSP}20${NBSP}min`,
    );
  });

  it('shows the circle, the clean days and the next rank', () => {
    const eyebrow = `Cercle${NBSP}II${NBSP}·${NBSP}Ombre`;
    expect(rankCardText(french, sorcerer)).toMatchObject({
      unlocked: true,
      eyebrow,
      name: 'Sorcier',
      progress: '47 jours propres',
      target: 'Mage blanc à 60',
      spokenLabel: `Sorcier, ${eyebrow}, 47 jours propres, Mage blanc à 60 jours propres`,
    });
    expect(rankCardText(english, sorcerer)).toMatchObject({
      eyebrow: `Circle${NBSP}II${NBSP}·${NBSP}Shadow`,
      name: 'Sorcerer',
      target: 'White mage at 60',
    });
  });

  it('says when every rank is unlocked', () => {
    expect(rankCardText(english, freeSoul)).toMatchObject({
      name: 'Free soul',
      target: 'All ranks unlocked',
      spokenLabel: `Free soul, Circle${NBSP}V${NBSP}·${NBSP}Absolute, 400 clean days, All ranks unlocked`,
    });
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

  it('are framed with the quotation marks of each language', () => {
    expect(english('home.quote.text', { text: 'A' })).toBe('“A”');
    expect(french('home.quote.text', { text: 'A' })).toBe(`«${NBSP}A${NBSP}»`);
  });
});
