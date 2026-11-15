import { checkInDate, moodOptions } from '@/features/check-in/labels';
import { localDayNumber } from '@/domain/local-time';
import { createI18n } from '@/lib/i18n';
import en from '@/lib/i18n/locales/en.json';
import fr from '@/lib/i18n/locales/fr.json';
import { zoneOffsetAt } from '@test/zones';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

function valuesOf(value: object): string[] {
  return Object.values(value).flatMap((child) =>
    typeof child === 'object' && child !== null ? valuesOf(child) : [String(child)],
  );
}

describe('checkInDate', () => {
  it('writes the local day with a capital letter', () => {
    const day = localDayNumber(Date.UTC(2025, 10, 13, 12), zoneOffsetAt('Europe/Paris'));
    expect(checkInDate('fr', day)).toBe('Jeudi 13 novembre');
    expect(checkInDate('en', day)).toBe('Thursday, November 13');
  });

  it('shows the stored local day, whatever the device time zone', () => {
    const lateInParis = Date.UTC(2025, 10, 13, 22, 30);
    const day = localDayNumber(lateInParis, zoneOffsetAt('Europe/Paris'));
    expect(checkInDate('fr', day)).toBe('Jeudi 13 novembre');
  });
});

describe('moodOptions', () => {
  it('says what both ends mean with their values', () => {
    expect(moodOptions(french).map((option) => option.spokenLabel)).toEqual([
      '1 sur 5, Pas bien',
      '2 sur 5',
      '3 sur 5',
      '4 sur 5',
      '5 sur 5, Très bien',
    ]);
    expect(moodOptions(english)[0]?.spokenLabel).toBe('1 out of 5, Not good');
  });
});

// docs/product/relapse.md: the check-in does not mention the lapse.
describe('check-in strings', () => {
  it('never mention a lapse', () => {
    expect(valuesOf(fr.checkIn).filter((text) => /écart|rechute/i.test(text))).toEqual([]);
    expect(valuesOf(en.checkIn).filter((text) => /lapse|relapse/i.test(text))).toEqual([]);
  });
});
