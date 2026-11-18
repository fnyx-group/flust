import { breathingLabel, countdownText, spokenCountdown } from '@/features/emergency/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const fr = createI18n('fr').t;
const en = createI18n('en').t;
const NBSP = '\u00a0';

describe('countdownText', () => {
  it('shows whole minutes, rounded up', () => {
    expect(countdownText(fr, { minutes: 20, seconds: 0 })).toBe(`20${NBSP}min`);
    expect(countdownText(fr, { minutes: 19, seconds: 42 })).toBe(`20${NBSP}min`);
    expect(countdownText(en, { minutes: 9, seconds: 0 })).toBe('9 min');
  });

  it('never shows zero while time remains', () => {
    expect(countdownText(en, { minutes: 0, seconds: 1 })).toBe('1 min');
    expect(countdownText(en, { minutes: 0, seconds: 0 })).toBe('0 min');
  });
});

describe('spokenCountdown', () => {
  it('reads the same minutes as the chip, in words', () => {
    expect(spokenCountdown(fr, { minutes: 19, seconds: 42 })).toBe('Encore 20 minutes');
    expect(spokenCountdown(en, { minutes: 0, seconds: 30 })).toBe('1 minute left');
    expect(spokenCountdown(en, { minutes: 20, seconds: 0 })).toBe('20 minutes left');
  });
});

describe('breathingLabel', () => {
  it('names each phase', () => {
    expect(
      (['inhale', 'hold', 'exhale'] as const).map((phase) => breathingLabel(fr, phase)),
    ).toEqual(['Inspire', 'Retiens', 'Expire']);
  });
});
