import { parseNoteContent, toNoteId, type NoteSummary } from '@/domain/journal';
import { localDayNumber, utcToLocal } from '@/domain/local-time';
import { MS_PER_DAY } from '@/domain/time';
import { unwrap } from '@test/arbitraries';
import {
  noteDateTime,
  noteGroupTitle,
  noteListDate,
  noteRowLabel,
  PROMPT_IDS,
} from '@/features/journal/labels';
import { createI18n } from '@/lib/i18n';
import { zoneOffsetAt } from '@test/zones';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

const english = createI18n('en').t;
const french = createI18n('fr').t;

const wednesday = Date.UTC(2025, 10, 12) / MS_PER_DAY;

describe('noteListDate', () => {
  it('writes the stored local day with a capital letter', () => {
    expect(noteListDate('fr', wednesday)).toBe('Mercredi 12 nov.');
    expect(noteListDate('en', wednesday)).toBe('Wednesday, Nov 12');
  });
});

describe('noteGroupTitle', () => {
  it('names the two recent weeks', () => {
    expect(noteGroupTitle(french, 'fr', { kind: 'this-week' }, 2026)).toBe('Cette semaine');
    expect(noteGroupTitle(french, 'fr', { kind: 'last-week' }, 2026)).toBe('Semaine dernière');
    expect(noteGroupTitle(english, 'en', { kind: 'last-week' }, 2026)).toBe('Last week');
  });

  it('shows the year of a month only when it is not the current one', () => {
    const october = { kind: 'month', year: 2026, month: 10 } as const;
    expect(noteGroupTitle(french, 'fr', october, 2026)).toBe('Octobre');
    expect(noteGroupTitle(french, 'fr', october, 2027)).toBe('Octobre 2026');
    expect(noteGroupTitle(english, 'en', october, 2027)).toBe('October 2026');
  });
});

describe('noteDateTime', () => {
  const local = { year: 2026, month: 11, day: 13, hour: 22, minute: 14 };

  it('writes the date and the time, in 24 or 12 hours', () => {
    expect(noteDateTime(french, 'fr', local, 2026, false)).toBe('Vendredi 13 novembre, 22:14');
    expect(noteDateTime(english, 'en', local, 2026, true)).toBe('Friday, November 13, 10:14 PM');
    expect(noteDateTime(english, 'en', local, 2026, false)).toBe('Friday, November 13, 22:14');
  });

  it('adds the year of another year', () => {
    expect(noteDateTime(french, 'fr', local, 2027, false)).toBe('Vendredi 13 novembre 2026, 22:14');
  });

  // A note shows the time it was written at, with the offset of that moment.
  it('reads the same after travel when given the stored offset', () => {
    const at = Date.UTC(2026, 10, 13, 21, 14);
    const paris = zoneOffsetAt('Europe/Paris');
    const offset = paris(at);
    const written = utcToLocal(at, () => offset);
    expect(noteDateTime(french, 'fr', written, 2026, false)).toBe('Vendredi 13 novembre, 22:14');
    expect(localDayNumber(at, () => offset)).toBe(localDayNumber(at, paris));
  });
});

describe('noteRowLabel', () => {
  const id = toNoteId(1);
  if (id === null) throw new Error('invalid id');
  const note: NoteSummary = { id, day: wednesday, createdAt: 0, title: null, excerpt: 'Calm day.' };

  it('reads the date, the title if any, then the text', () => {
    expect(noteRowLabel('fr', note)).toBe('Mercredi 12 nov., Calm day.');
    const { title } = unwrap(parseNoteContent({ title: 'Un bon jour', body: 'Text' }));
    expect(noteRowLabel('fr', { ...note, title })).toBe('Mercredi 12 nov., Un bon jour, Calm day.');
  });
});

describe('prompts', () => {
  it('have a label and a starter in both languages', () => {
    for (const t of [french, english]) {
      for (const id of PROMPT_IDS) {
        expect(t(`journal.note.promptLabels.${id}`)).not.toMatch(/^journal\./);
        expect(t(`journal.note.promptStarters.${id}`)).toMatch(/ $/);
      }
    }
  });

  // docs/design/design-system.md: French text never assumes the user's gender.
  it('use the neutral French wording', () => {
    expect(french('journal.note.promptLabels.helped')).toBe("Qu'est-ce qui t'a fait du bien ?");
    expect(french('journal.note.promptStarters.helped')).toBe("Ce qui m'a fait du bien : ");
  });
});
