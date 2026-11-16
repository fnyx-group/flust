import { languageLabel, planCountLabel } from '@/features/settings/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

describe('languageLabel', () => {
  it('names the device choice in the app language, and each language in itself', () => {
    expect(languageLabel(french, 'device')).toBe("Langue de l'appareil");
    expect(languageLabel(english, 'device')).toBe('Device language');
    expect(languageLabel(english, 'fr')).toBe('Français');
    expect(languageLabel(french, 'en')).toBe('English');
  });
});

describe('planCountLabel', () => {
  it('follows each language plural rules', () => {
    expect(planCountLabel(french, 1)).toBe('1 plan');
    expect(planCountLabel(french, 2)).toBe('2 plans');
    expect(planCountLabel(english, 1)).toBe('1 plan');
    expect(planCountLabel(english, 5)).toBe('5 plans');
  });
});

describe('settings footer', () => {
  it('names the version and keeps the dot on its line', () => {
    expect(french('settings.footer', { version: '0.1.0' })).toBe(
      'flust 0.1.0\u00a0· Open source, chiffré sur ton téléphone',
    );
    expect(english('settings.footer', { version: '0.1.0' })).toBe(
      'flust 0.1.0\u00a0· Open source, encrypted on your phone',
    );
  });
});
