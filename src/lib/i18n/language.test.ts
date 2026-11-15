import { DEVICE_LANGUAGE, languageOf, resolveLanguage, toPreference } from './language';

describe('resolveLanguage', () => {
  it('keeps supported languages', () => {
    expect(resolveLanguage('fr')).toBe('fr');
    expect(resolveLanguage('en')).toBe('en');
  });

  it('falls back to English for an unsupported language', () => {
    expect(resolveLanguage('de')).toBe('en');
  });

  it('falls back to English when the device reports no language', () => {
    expect(resolveLanguage(null)).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });
});

describe('toPreference', () => {
  it('keeps a chosen language', () => {
    expect(toPreference('fr')).toBe('fr');
    expect(toPreference('en')).toBe('en');
  });

  it('reads the device choice, nothing stored or an unknown value as the device language', () => {
    expect(toPreference(DEVICE_LANGUAGE)).toBe(DEVICE_LANGUAGE);
    expect(toPreference(null)).toBe(DEVICE_LANGUAGE);
    expect(toPreference('de')).toBe(DEVICE_LANGUAGE);
  });
});

describe('languageOf', () => {
  it('follows the device only when the device language is chosen', () => {
    expect(languageOf(DEVICE_LANGUAGE, 'fr')).toBe('fr');
    expect(languageOf('en', 'fr')).toBe('en');
  });
});
