import { breathingLabel, countdownText, spokenCountdown } from '@/features/emergency/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

describe('countdownText', () => {
  it('shows minutes and seconds on two digits', () => {
    expect(countdownText({ minutes: 20, seconds: 0 })).toBe('20:00');
    expect(countdownText({ minutes: 9, seconds: 5 })).toBe('09:05');
    expect(countdownText({ minutes: 0, seconds: 0 })).toBe('00:00');
  });
});

describe('spokenCountdown', () => {
  const fr = createI18n('fr').t;
  const en = createI18n('en').t;

  it('reads the time left in words', () => {
    expect(spokenCountdown(fr, { minutes: 19, seconds: 42 })).toBe('Encore 19 minutes 42 secondes');
    expect(spokenCountdown(en, { minutes: 1, seconds: 1 })).toBe('1 minute 1 second left');
  });

  it('leaves out a part that is zero, but always says something', () => {
    expect(spokenCountdown(en, { minutes: 20, seconds: 0 })).toBe('20 minutes left');
    expect(spokenCountdown(en, { minutes: 0, seconds: 30 })).toBe('30 seconds left');
    expect(spokenCountdown(en, { minutes: 0, seconds: 0 })).toBe('0 seconds left');
  });
});

describe('breathingLabel', () => {
  it('names each phase', () => {
    const fr = createI18n('fr').t;
    expect(
      (['inhale', 'hold', 'exhale'] as const).map((phase) => breathingLabel(fr, phase)),
    ).toEqual(['Inspire', 'Retiens', 'Expire']);
  });
});
