import type { TFunction } from 'i18next';

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
  spokenStreak,
  spokenWeek,
  weekdayInitial,
} from '@/features/home/labels';
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
const almostWhiteMage = rankStanding(journey, [], start + 59.5 * MS_PER_DAY);
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

function counterWidth(
  t: TFunction,
  display: StreakDisplay,
  fontSize = counterFontSizes[counterSize(display)],
): number {
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

// The counter spans the screen width minus its padding: 320 points on a 360 point screen.
const COUNTER_WIDTH = sizes.counterDesignWidth - 2 * spacing.screen;

describe.each([
  ['en', english],
  ['fr', french],
] as const)('streak counter width in %s', (_, t) => {
  it.each(WIDEST)('fits %o on one line at the design width', (display) => {
    expect(counterWidth(t, display)).toBeLessThanOrEqual(COUNTER_WIDTH);
  });
});

describe('streak counter sizes', () => {
  it.each(WIDEST)('are the largest that fit %o in both languages', (display) => {
    const larger = counterFontSizes[counterSize(display)] + 1;
    const widest = Math.max(
      counterWidth(english, display, larger),
      counterWidth(french, display, larger),
    );
    expect(widest).toBeGreaterThan(COUNTER_WIDTH);
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
    expect(spokenQuote(french, '« A »', 'Sénèque')).toBe(`Mot du jour${NBSP}: « A », Sénèque`);
    expect(spokenQuote(english, '“A”', null)).toBe('Quote of the day: “A”');
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
