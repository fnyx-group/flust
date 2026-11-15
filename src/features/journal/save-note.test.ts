import type { JournalRepository } from '@/data/journal-repository';
import { NOTE_BODY_MAX_LENGTH, parseNoteContent, toNoteId, type Note } from '@/domain/journal';
import { localDayNumber } from '@/domain/local-time';
import { err, ok } from '@/domain/result';
import { MS_PER_DAY } from '@/domain/time';
import { saveNote } from '@/features/journal/save-note';
import { unwrap } from '@test/arbitraries';
import { zoneOffsetAt } from '@test/zones';

const paris = zoneOffsetAt('Europe/Paris');
const ID = toNoteId(7) ?? fail('7 is a valid note id');

function fail(message: string): never {
  throw new Error(message);
}

type Create = JournalRepository['create'];
type Update = JournalRepository['update'];

function repository(failure = false) {
  const create = jest.fn<ReturnType<Create>, Parameters<Create>>(async (origin, content) =>
    failure
      ? err('storage-failed')
      : ok({ id: ID, ...origin, createdAt: origin.at, updatedAt: origin.at, ...content }),
  );
  const update = jest.fn<ReturnType<Update>, Parameters<Update>>(async () => err('not-found'));
  return { create, update };
}

const existing: Note = {
  id: ID,
  day: 20_000,
  createdAt: 20_000 * MS_PER_DAY,
  offset: 60,
  updatedAt: 20_000 * MS_PER_DAY,
  ...unwrap(parseNoteContent({ title: '', body: 'Before' })),
};

describe('saveNote', () => {
  it('dates a new note with the local day and the offset of the time of saving', async () => {
    const now = Date.UTC(2026, 6, 14, 22, 30);
    const journal = repository();

    const saved = await saveNote(journal, null, { title: ' Hi ', body: ' Text ' }, now, paris);
    expect(journal.create).toHaveBeenCalledWith(
      { day: localDayNumber(now, paris), at: now, offset: 120 },
      { title: 'Hi', body: 'Text' },
    );
    expect(saved.ok).toBe(true);
  });

  it('updates an existing note', async () => {
    const journal = repository();
    const after: Note = { ...existing, ...unwrap(parseNoteContent({ title: '', body: 'After' })) };
    journal.update.mockResolvedValueOnce(ok(after));

    const saved = await saveNote(journal, existing, { title: '', body: 'After' }, 5, paris);
    expect(journal.update).toHaveBeenCalledWith(ID, 5, { title: null, body: 'After' });
    expect(journal.create).not.toHaveBeenCalled();
    expect(saved).toEqual(ok(after));
  });

  it('never saves an empty note or one too long', async () => {
    const journal = repository();
    expect(await saveNote(journal, null, { title: 'Title', body: ' ' }, 0, paris)).toEqual(
      err('empty'),
    );
    const body = 'a'.repeat(NOTE_BODY_MAX_LENGTH + 1);
    expect(await saveNote(journal, existing, { title: '', body }, 0, paris)).toEqual(
      err('body-too-long'),
    );
    expect(journal.create).not.toHaveBeenCalled();
    expect(journal.update).not.toHaveBeenCalled();
  });

  it('reports a storage failure or a note gone missing as a failed save', async () => {
    expect(await saveNote(repository(true), null, { title: '', body: 'T' }, 0, paris)).toEqual(
      err('save-failed'),
    );
    expect(await saveNote(repository(), existing, { title: '', body: 'T' }, 0, paris)).toEqual(
      err('save-failed'),
    );
  });
});
