import { spokenStreak } from '@/features/shared/streak-labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

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
