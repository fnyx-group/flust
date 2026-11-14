import { resolveLanguage } from './language';

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
