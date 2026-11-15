import * as fc from 'fast-check';

import {
  draftOf,
  EMPTY_NOTE_DRAFT,
  groupNotes,
  hasUnsavedChanges,
  insertPrompt,
  NOTE_BODY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  parseNote,
  parseNoteContent,
  parseNoteSummary,
  toNoteId,
  type Note,
  type NoteGroupKey,
  type NoteId,
  type NoteSummary,
  type StoredNote,
} from '@/domain/journal';
import { weekdayOf, type Weekday } from '@/domain/local-time';
import { err, ok } from '@/domain/result';
import { MS_PER_DAY } from '@/domain/time';
import { unwrap } from '@test/arbitraries';

const MONDAY: Weekday = 2;
const SUNDAY: Weekday = 1;

function dayOf(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function id(value: number): NoteId {
  const noteId = toNoteId(value);
  if (noteId === null) throw new Error(`${value} is not a note id`);
  return noteId;
}

function summary(noteId: number, day: number, createdAt = day * MS_PER_DAY): NoteSummary {
  return { id: id(noteId), day, createdAt, title: null, excerpt: `Note ${noteId}` };
}

describe('parseNoteContent', () => {
  it('trims the text, keeps its line breaks and puts the title on one line', () => {
    expect(
      parseNoteContent({ title: '  A  good\n day ', body: '\r\n First line\r\n\nSecond  \n' }),
    ).toEqual(ok({ title: 'A good day', body: 'First line\n\nSecond' }));
  });

  it('stores an empty title as no title', () => {
    expect(unwrap(parseNoteContent({ title: ' \n ', body: 'Text' })).title).toBeNull();
  });

  it('refuses a note without text, even with a title', () => {
    expect(parseNoteContent(EMPTY_NOTE_DRAFT)).toEqual(err('empty'));
    expect(parseNoteContent({ title: 'Only a title', body: ' \n\t ' })).toEqual(err('empty'));
  });

  it('allows the length limits and refuses one more', () => {
    const title = 'a'.repeat(NOTE_TITLE_MAX_LENGTH);
    const body = 'b'.repeat(NOTE_BODY_MAX_LENGTH);
    expect(parseNoteContent({ title, body }).ok).toBe(true);
    expect(parseNoteContent({ title: `${title}a`, body })).toEqual(err('title-too-long'));
    expect(parseNoteContent({ title, body: `${body}b` })).toEqual(err('body-too-long'));
  });

  it('counts code points, so a simple emoji counts once', () => {
    const body = '\u{1F642}'.repeat(NOTE_BODY_MAX_LENGTH);
    expect(body.length).toBe(2 * NOTE_BODY_MAX_LENGTH);
    expect(parseNoteContent({ title: '', body }).ok).toBe(true);
  });
});

describe('hasUnsavedChanges', () => {
  const saved = { title: 'Title', body: 'Text' };

  it('sees a change of title or text', () => {
    expect(hasUnsavedChanges(saved, { ...saved, title: 'Other' })).toBe(true);
    expect(hasUnsavedChanges(saved, { ...saved, body: 'Text, more' })).toBe(true);
    expect(hasUnsavedChanges(saved, { ...saved, title: '' })).toBe(true);
  });

  it('ignores what saving would remove', () => {
    expect(hasUnsavedChanges(saved, { title: ' Title ', body: '\nText  \n' })).toBe(false);
    expect(hasUnsavedChanges(EMPTY_NOTE_DRAFT, { title: '  ', body: '\n\n' })).toBe(false);
  });

  it('sees a new note with only a title, which is not saved', () => {
    expect(hasUnsavedChanges(EMPTY_NOTE_DRAFT, { title: 'Title', body: '' })).toBe(true);
  });

  it('ignores a prompt inserted then erased', () => {
    const withPrompt = unwrap(insertPrompt(saved.body, 'Tomorrow, I '));
    expect(hasUnsavedChanges(saved, { ...saved, body: withPrompt })).toBe(true);
    expect(hasUnsavedChanges(saved, { ...saved, body: 'Text\n\n' })).toBe(false);
  });
});

describe('draftOf', () => {
  it('starts a new note empty and loads an existing one', () => {
    expect(draftOf(null)).toBe(EMPTY_NOTE_DRAFT);
    const note: Note = {
      id: id(1),
      day: 1,
      createdAt: 0,
      offset: 0,
      updatedAt: 0,
      ...unwrap(parseNoteContent({ title: '', body: 'Text' })),
    };
    expect(draftOf(note)).toEqual({ title: '', body: 'Text' });
  });
});

describe('insertPrompt', () => {
  it('starts an empty text with the starter', () => {
    expect(insertPrompt('', 'Tomorrow, I ')).toEqual(ok('Tomorrow, I '));
    expect(insertPrompt(' \n ', 'Tomorrow, I ')).toEqual(ok('Tomorrow, I '));
  });

  it('adds the starter on a new paragraph after the text', () => {
    expect(insertPrompt('Calm day.\n\n', 'Tomorrow, I ')).toEqual(ok('Calm day.\n\nTomorrow, I '));
  });

  it('leaves the text alone when the starter would not fit', () => {
    const full = 'a'.repeat(NOTE_BODY_MAX_LENGTH - 5);
    expect(insertPrompt(full, 'Tomorrow, I ')).toEqual(err('too-long'));
  });
});

describe('parseNote', () => {
  const stored: StoredNote = {
    id: 3,
    day: 20_000,
    createdAt: Date.UTC(2024, 9, 4, 20),
    offset: 120,
    updatedAt: Date.UTC(2024, 9, 5, 8),
    title: 'Title',
    body: 'Line one\nLine two',
  };

  it('reads a stored note', () => {
    expect(parseNote(stored)).toEqual(ok(stored));
    expect(parseNote({ ...stored, title: null })).toEqual(ok({ ...stored, title: null }));
  });

  it.each<[string, Partial<StoredNote>]>([
    ['an id of 0', { id: 0 }],
    ['an id as text', { id: '3' }],
    ['a fractional day', { day: 1.5 }],
    ['a negative time of creation', { createdAt: -1 }],
    ['an offset beyond 18 hours', { offset: 18 * 60 + 1 }],
    ['a fractional offset', { offset: 30.5 }],
    ['a missing time of change', { updatedAt: null }],
    ['an empty title', { title: '' }],
    ['a title on two lines', { title: 'A\nB' }],
    ['a title as a number', { title: 4 }],
    ['an empty text', { body: '' }],
    ['a text with spaces around it', { body: ' Text ' }],
    ['a text too long', { body: 'a'.repeat(NOTE_BODY_MAX_LENGTH + 1) }],
    ['a text that is not text', { body: null }],
  ])('refuses %s', (_, change) => {
    expect(parseNote({ ...stored, ...change })).toEqual(err('invalid-note'));
  });
});

describe('parseNoteSummary', () => {
  const stored = { id: 1, day: 10, createdAt: 10 * MS_PER_DAY, title: 'Title', excerpt: 'Text' };

  it('reads a stored summary, cut wherever the excerpt ends', () => {
    expect(parseNoteSummary(stored)).toEqual(ok(stored));
    expect(parseNoteSummary({ ...stored, title: null, excerpt: 'Cut mid \n' })).toEqual(
      ok({ ...stored, title: null, excerpt: 'Cut mid' }),
    );
  });

  it.each<[string, Record<string, unknown>]>([
    ['an invalid id', { id: -1 }],
    ['an invalid day', { day: Number.NaN }],
    ['an invalid time of creation', { createdAt: 1.5 }],
    ['an empty title', { title: '' }],
    ['a title not normalized', { title: ' Title' }],
    ['a title too long', { title: 'a'.repeat(NOTE_TITLE_MAX_LENGTH + 1) }],
    ['a title as a number', { title: 1 }],
    ['an empty excerpt', { excerpt: ' ' }],
    ['an excerpt that is not text', { excerpt: null }],
  ])('refuses %s', (_, change) => {
    expect(parseNoteSummary({ ...stored, ...change })).toEqual(err('invalid-note'));
  });
});

describe('toNoteId', () => {
  it('accepts positive safe integers only', () => {
    expect(toNoteId(12)).toBe(12);
    expect(toNoteId(0)).toBeNull();
    expect(toNoteId(1.5)).toBeNull();
    expect(toNoteId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });
});

describe('groupNotes', () => {
  // Thursday 12 November 2026.
  const today = dayOf(2026, 11, 12);

  function keys(notes: readonly NoteSummary[], first: Weekday = MONDAY): NoteGroupKey[] {
    return groupNotes(notes, today, first).map((group) => group.key);
  }

  it('has no group without notes', () => {
    expect(groupNotes([], today, MONDAY)).toEqual([]);
  });

  it('groups this week, last week, then by month', () => {
    const notes = [
      summary(1, today),
      summary(2, dayOf(2026, 11, 10)),
      summary(3, dayOf(2026, 11, 9)),
      summary(4, dayOf(2026, 11, 8)),
      summary(5, dayOf(2026, 11, 2)),
      summary(6, dayOf(2026, 11, 1)),
      summary(7, dayOf(2026, 10, 3)),
      summary(8, dayOf(2025, 12, 31)),
    ];
    expect(
      groupNotes(notes, today, MONDAY).map((group) => [group.key, group.notes.map((n) => n.id)]),
    ).toEqual([
      [{ kind: 'this-week' }, [1, 2, 3]],
      [{ kind: 'last-week' }, [4, 5]],
      [{ kind: 'month', year: 2026, month: 11 }, [6]],
      [{ kind: 'month', year: 2026, month: 10 }, [7]],
      [{ kind: 'month', year: 2025, month: 12 }, [8]],
    ]);
  });

  it('starts the week on the first weekday of the region', () => {
    const sunday = dayOf(2026, 11, 8);
    expect(keys([summary(1, sunday)], MONDAY)).toEqual([{ kind: 'last-week' }]);
    expect(keys([summary(1, sunday)], SUNDAY)).toEqual([{ kind: 'this-week' }]);
    const saturdayBefore = dayOf(2026, 11, 7);
    expect(keys([summary(1, saturdayBefore)], SUNDAY)).toEqual([{ kind: 'last-week' }]);
  });

  it('keeps a week across two months together', () => {
    const monday = dayOf(2026, 9, 28);
    const thursday = dayOf(2026, 10, 1);
    const notes = [summary(1, monday), summary(2, monday - 1)];
    expect(groupNotes(notes, thursday, MONDAY).map((group) => group.key)).toEqual([
      { kind: 'this-week' },
      { kind: 'last-week' },
    ]);
  });

  it('puts the first day of the week in this week, and the day before in last week', () => {
    const monday = dayOf(2026, 11, 9);
    expect(keys([summary(1, monday), summary(2, monday - 1)])).toEqual([
      { kind: 'this-week' },
      { kind: 'last-week' },
    ]);
    expect(keys([summary(1, monday - 7), summary(2, monday - 8)])).toEqual([
      { kind: 'last-week' },
      { kind: 'month', year: 2026, month: 11 },
    ]);
  });

  it('counts days after today, left by a clock set back, as this week', () => {
    expect(keys([summary(1, today + 30)])).toEqual([{ kind: 'this-week' }]);
  });

  // After a flight west, a note written later can fall on an earlier local day.
  it('orders by day, then by time of creation, so no group is split', () => {
    const later = summary(1, today - 3, today * MS_PER_DAY + 5);
    const earlier = summary(2, today, today * MS_PER_DAY);
    const older = summary(3, today - 3, today * MS_PER_DAY - 5);
    const groups = groupNotes([later, earlier, older], today, MONDAY);
    expect(groups.map((group) => group.notes.map((note) => note.id))).toEqual([[2, 1, 3]]);
  });

  it('puts every note in exactly one group, the newest first', () => {
    const day = fc.integer({ min: today - 800, max: today + 3 });
    const notes = fc
      .array(fc.tuple(day, fc.nat({ max: MS_PER_DAY - 1 })), { maxLength: 40 })
      .map((entries) =>
        entries.map(([noteDay, time], index) =>
          summary(index + 1, noteDay, noteDay * MS_PER_DAY + time),
        ),
      );
    const weekday = fc.constantFrom<Weekday>(1, 2, 3, 4, 5, 6, 7);

    fc.assert(
      fc.property(notes, weekday, (input, first) => {
        const groups = groupNotes(input, today, first);
        const flat = groups.flatMap((group) => group.notes);
        expect(flat.map((note) => note.id).sort((a, b) => a - b)).toEqual(
          input.map((note) => note.id).sort((a, b) => a - b),
        );
        for (let index = 1; index < flat.length; index++) {
          const previous = flat[index - 1];
          const current = flat[index];
          if (previous === undefined || current === undefined) continue;
          expect(previous.day > current.day || previous.createdAt >= current.createdAt).toBe(true);
          expect(previous.day).toBeGreaterThanOrEqual(current.day);
        }
        const names = groups.map((group) => JSON.stringify(group.key));
        expect(new Set(names).size).toBe(names.length);
        for (const group of groups) {
          if (group.key.kind !== 'this-week') continue;
          for (const note of group.notes) {
            expect(today - note.day).toBeLessThanOrEqual((weekdayOf(today) - first + 7) % 7);
          }
        }
      }),
    );
  });
});
