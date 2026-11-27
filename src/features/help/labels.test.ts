import { ALL_HELP_ENTRIES, HELP_REGIONS, helpEntries } from '@/domain/help-resources';
import {
  actionHint,
  checkedMonth,
  entryDetail,
  entryName,
  openFailedMessage,
  regionLabel,
  spokenAction,
  spokenNumber,
  textRowLabel,
  unbrokenNumber,
} from '@/features/help/labels';
import { createI18n } from '@/lib/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

function entryOf(region: Parameters<typeof helpEntries>[0], index: number) {
  const entry = helpEntries(region, null)[index];
  if (entry === undefined) throw new Error('missing entry');
  return entry;
}

describe('entry labels', () => {
  it('name and describe every entry in both languages', () => {
    for (const t of [english, french]) {
      for (const entry of ALL_HELP_ENTRIES) {
        expect(entryName(t, entry)).not.toMatch(/^help\./);
        expect(entryDetail(t, entry)).not.toMatch(/^help\./);
      }
    }
  });

  it('name every region of the picker in both languages', () => {
    for (const t of [english, french]) {
      for (const region of HELP_REGIONS) expect(regionLabel(t, region)).not.toMatch(/^help\./);
    }
    expect(regionLabel(french, 'US')).toBe('États-Unis');
    expect(regionLabel(english, 'other')).toBe('Another country');
  });
});

describe('spokenNumber', () => {
  it('separates digits so they are read one by one', () => {
    expect(spokenNumber('3114')).toBe('3 1 1 4');
    expect(spokenNumber('116 123')).toBe('1 1 6 1 2 3');
    expect(spokenNumber('15')).toBe('1 5');
  });
});

describe('spokenAction', () => {
  it('reads the action, the number digit by digit, the service and its detail', () => {
    expect(spokenAction(french, entryOf('FR', 0), 'call')).toBe(
      'Appeler le 3 1 1 4, Prévention du suicide. Numéro national, gratuit, 24\u00a0h/24 et 7\u00a0j/7',
    );
    expect(spokenAction(english, entryOf('US', 0), 'text')).toBe(
      'Text 9 8 8, 988 Suicide & Crisis Lifeline. Free call or text, 24/7',
    );
    expect(spokenAction(english, entryOf('CH', 0), 'call')).toBe(
      'Call 1 4 3, La Main Tendue. Anonymous, day and night. A few cents depending on the operator.',
    );
  });

  it('gives each action its own hint', () => {
    expect(actionHint(english, 'call')).toBe('Opens the phone app with this number');
    expect(actionHint(english, 'text')).toBe('Opens messages with this number');
  });
});

describe('unbrokenNumber', () => {
  it('joins the groups of a number with no-break spaces', () => {
    expect(unbrokenNumber('0800 32 123')).toBe('0800\u00a032\u00a0123');
    expect(unbrokenNumber('3114')).toBe('3114');
  });

  it('names the number of the text row', () => {
    expect(textRowLabel(french, entryOf('US', 0))).toBe('Ou par SMS au 988');
    expect(textRowLabel(english, entryOf('CA', 0))).toBe('Or text 988');
  });
});

describe('openFailedMessage', () => {
  it('gives the number to dial or text by hand, on one line', () => {
    expect(openFailedMessage(french, entryOf('GB', 0), 'call')).toBe(
      "Le téléphone n'a pas pu s'ouvrir. Tu peux composer le 116\u00a0123 toi-même.",
    );
    expect(openFailedMessage(english, entryOf('CA', 0), 'text')).toBe(
      'Messages could not open. You can text 988 yourself.',
    );
  });
});

describe('checkedMonth', () => {
  it('names the month of a check in the app language', () => {
    expect(checkedMonth('fr', '2026-11-16')).toBe('novembre 2026');
    expect(checkedMonth('en', '2026-11-16')).toBe('November 2026');
  });

  it('keeps the day of the check whatever the time zone', () => {
    expect(checkedMonth('en', '2026-12-01')).toBe('December 2026');
  });

  it('shows nothing without a readable check', () => {
    expect(checkedMonth('en', null)).toBeNull();
    expect(checkedMonth('en', 'soon')).toBeNull();
  });
});
