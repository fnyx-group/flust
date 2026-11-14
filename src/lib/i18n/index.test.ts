import { createI18n } from './index';
import en from './locales/en.json';
import fr from './locales/fr.json';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? keysOf(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function valuesOf(value: object): string[] {
  return Object.values(value).flatMap((child) =>
    typeof child === 'object' && child !== null ? valuesOf(child) : [String(child)],
  );
}

function expectDayPlurals() {
  const french = createI18n('fr');
  expect(french.t('units.day', { count: 0 })).toBe('0 jour');
  expect(french.t('units.day', { count: 1 })).toBe('1 jour');
  expect(french.t('units.day', { count: 2 })).toBe('2 jours');

  const english = createI18n('en');
  expect(english.t('units.day', { count: 0 })).toBe('0 days');
  expect(english.t('units.day', { count: 1 })).toBe('1 day');
  expect(english.t('units.day', { count: 2 })).toBe('2 days');
}

describe('plurals', () => {
  it('follows French and English rules', () => {
    expectDayPlurals();
  });

  describe('without Intl.PluralRules, as on Hermes', () => {
    const pluralRules = Intl.PluralRules;

    beforeEach(() => {
      Reflect.deleteProperty(Intl, 'PluralRules');
    });

    afterEach(() => {
      Object.assign(Intl, { PluralRules: pluralRules });
    });

    it('follows French and English rules', () => {
      expectDayPlurals();
    });
  });
});

describe('locales', () => {
  it('have exactly the same keys in English and French', () => {
    expect(keysOf(fr).sort()).toEqual(keysOf(en).sort());
  });

  // docs/design/design-system.md: a narrow no-break space before ? ! ; and a no-break space
  // before :, so the sign never wraps alone onto the next line.
  it('put the right no-break space before French double punctuation', () => {
    const french = valuesOf(fr);
    expect(french.filter((text) => /(?<!\u202f)[?!;]/.test(text))).toEqual([]);
    expect(french.filter((text) => /(?<!\u00a0):/.test(text))).toEqual([]);
    expect(french.some((text) => text.includes('\u202f?'))).toBe(true);
  });
});
