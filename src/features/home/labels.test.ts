import { QUOTES } from '@/domain/quotes';
import { rankProgress, rankStanding } from '@/domain/ranks';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { rankCardText, spokenStreak } from '@/features/home/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;
const NBSP = ' ';

const sevenHoursForty = 7 * MS_PER_HOUR + 40 * MS_PER_MINUTE + 30_000;
const firstDay = rankStanding(rankProgress([], 0), 0, sevenHoursForty);
const sorcerer = rankStanding(rankProgress([], 47), 47, 12 * MS_PER_DAY);
const freeSoul = rankStanding(rankProgress([], 400), 400, 0);

describe('spokenStreak', () => {
  it('reads the counter as a full sentence', () => {
    expect(spokenStreak(english, { unit: 'days', days: 12 })).toBe('12 days');
    expect(spokenStreak(english, { unit: 'days', days: 1 })).toBe('1 day');
    expect(spokenStreak(english, { unit: 'hours', hours: 7, minutes: 40 })).toBe(
      '7 hours 40 minutes',
    );
    expect(spokenStreak(english, { unit: 'hours', hours: 1, minutes: 1 })).toBe('1 hour 1 minute');
  });

  it('follows French plurals, where 0 and 1 are singular', () => {
    expect(spokenStreak(french, { unit: 'hours', hours: 1, minutes: 0 })).toBe('1 heure 0 minute');
    expect(spokenStreak(french, { unit: 'hours', hours: 7, minutes: 40 })).toBe(
      '7 heures 40 minutes',
    );
  });

  it('leaves out the hours during the first hour', () => {
    expect(spokenStreak(english, { unit: 'hours', hours: 0, minutes: 5 })).toBe('5 minutes');
  });
});

describe('rankCardText', () => {
  it('shows the first rank locked, with the time left to it, before day one', () => {
    expect(rankCardText(french, firstDay)).toMatchObject({
      rank: { id: 'novice' },
      unlocked: false,
      eyebrow: 'Premier rang',
      name: 'Novice',
      progress: 'Débloqué dans 16 h 20',
      target: '1 jour',
      spokenProgress: 'Débloqué dans 16 heures 20 minutes, 1 jour',
    });
    expect(rankCardText(english, firstDay).progress).toBe('Unlocks in 16 h 20 min');
  });

  it('shows the circle, the clean days and the next rank', () => {
    expect(rankCardText(french, sorcerer)).toMatchObject({
      unlocked: true,
      eyebrow: 'Cercle II · Ombre',
      name: 'Sorcier',
      progress: '47 jours propres',
      target: 'Mage blanc à 60',
      spokenProgress: '47 jours propres, Mage blanc à 60 jours propres',
    });
    expect(rankCardText(english, sorcerer)).toMatchObject({
      eyebrow: 'Circle II · Shadow',
      name: 'Sorcerer',
      target: 'White mage at 60',
    });
  });

  it('says when every rank is unlocked', () => {
    expect(rankCardText(english, freeSoul)).toMatchObject({
      eyebrow: 'Circle V · Absolute',
      name: 'Free soul',
      target: 'All ranks unlocked',
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
