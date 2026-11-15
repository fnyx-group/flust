import type { NoteOrigin } from '@/data/journal-repository';
import { openStorage } from '@/data/open-storage';
import { parseNoteContent, toNoteId, type NoteContent, type NoteId } from '@/domain/journal';
import { err, ok } from '@/domain/result';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/time';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const DAY = 20_000;
const AT = DAY * MS_PER_DAY + 20 * MS_PER_HOUR;
const origin: NoteOrigin = { day: DAY, at: AT, offset: 60 };

function content(body: string, title = ''): NoteContent {
  return unwrap(parseNoteContent({ title, body }));
}

function noteId(value: number): NoteId {
  const id = toNoteId(value);
  if (id === null) throw new Error('invalid id');
  return id;
}

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('journal repository', () => {
  it('stores a new note and returns it as stored', async () => {
    const { storage } = await setUp();
    const saved = unwrap(await storage.journal.create(origin, content('First line\nSecond', 'Hi')));

    expect(saved).toEqual({
      id: saved.id,
      day: DAY,
      createdAt: AT,
      offset: 60,
      updatedAt: AT,
      title: 'Hi',
      body: 'First line\nSecond',
    });
    expect(await storage.journal.get(saved.id)).toEqual(ok(saved));
  });

  it('keeps the day, the time and the offset of creation when a note is edited', async () => {
    const { storage } = await setUp();
    const created = unwrap(await storage.journal.create(origin, content('Draft', 'Title')));
    const later = AT + 3 * MS_PER_DAY;

    const edited = await storage.journal.update(created.id, later, content('Final'));
    expect(edited).toEqual(ok({ ...created, updatedAt: later, title: null, body: 'Final' }));
    expect(await storage.journal.get(created.id)).toEqual(edited);
  });

  it('reports an edit of a note that does not exist', async () => {
    const { storage } = await setUp();
    expect(await storage.journal.update(noteId(42), AT, content('Text'))).toEqual(err('not-found'));
    expect(await storage.journal.get(noteId(42))).toEqual(ok(null));
  });

  it('removes a note, and succeeds when it is already gone', async () => {
    const { storage } = await setUp();
    const created = unwrap(await storage.journal.create(origin, content('Text')));

    expect(await storage.journal.remove(created.id)).toEqual(ok(undefined));
    expect(await storage.journal.get(created.id)).toEqual(ok(null));
    expect(await storage.journal.remove(created.id)).toEqual(ok(undefined));
    expect(await storage.journal.list()).toEqual(ok([]));
  });

  it('lists the latest day first, then the latest note of a day first', async () => {
    const { storage } = await setUp();
    const old = unwrap(await storage.journal.create({ ...origin, day: DAY - 9 }, content('Old')));
    const morning = unwrap(await storage.journal.create(origin, content('Morning')));
    const evening = unwrap(
      await storage.journal.create({ ...origin, at: AT + MS_PER_HOUR }, content('Evening', 'E')),
    );
    // Written last, but on an earlier local day after a flight west.
    const west = unwrap(
      await storage.journal.create(
        { day: DAY - 1, at: AT + 2 * MS_PER_HOUR, offset: -480 },
        content('West'),
      ),
    );

    expect(await storage.journal.list()).toEqual(
      ok([
        { id: evening.id, day: DAY, createdAt: AT + MS_PER_HOUR, title: 'E', excerpt: 'Evening' },
        { id: morning.id, day: DAY, createdAt: AT, title: null, excerpt: 'Morning' },
        {
          id: west.id,
          day: DAY - 1,
          createdAt: AT + 2 * MS_PER_HOUR,
          title: null,
          excerpt: 'West',
        },
        { id: old.id, day: DAY - 9, createdAt: AT, title: null, excerpt: 'Old' },
      ]),
    );
  });

  it('lists only the start of long notes', async () => {
    const { storage } = await setUp();
    unwrap(await storage.journal.create(origin, content('é'.repeat(5_000))));

    const [summary] = unwrap(await storage.journal.list());
    expect(summary?.excerpt).toBe('é'.repeat(280));
  });

  // SQLite cuts on code points, so an emoji outside the basic plane is never split in two.
  it('cuts the start of a long note between characters, never inside an emoji', async () => {
    const { storage } = await setUp();
    unwrap(await storage.journal.create(origin, content(`a${'\u{1F642}'.repeat(4_000)}`)));

    const [summary] = unwrap(await storage.journal.list());
    expect(summary?.excerpt).toBe(`a${'\u{1F642}'.repeat(279)}`);
  });

  // A row the editor cannot open must not be listed: tapping it would lead nowhere.
  it.each([
    ['an invalid time of change', 'updated_at = -1'],
    ['a text ending with a space', "body = body || ' '"],
    ['a text starting with a line break', 'body = char(10) || body'],
    ['a text with a carriage return', "body = 'One' || char(13) || char(10) || 'Two'"],
    ['a text too long', "body = printf('%.*c', 10001, 'a')"],
  ])('lists only notes that can be opened, leaving out %s', async (_, change) => {
    const { storage, rawDatabase } = await setUp();
    const kept = unwrap(await storage.journal.create(origin, content('Kept')));
    const broken = unwrap(await storage.journal.create(origin, content('Broken')));
    const raw = await rawDatabase();
    await raw.run(`UPDATE journal_note SET ${change} WHERE id = ?`, [broken.id]);
    await raw.close();

    expect(await storage.journal.get(broken.id)).toEqual(ok(null));
    expect(unwrap(await storage.journal.list()).map((note) => note.id)).toEqual([kept.id]);
  });

  it('leaves out rows that fail validation', async () => {
    const { storage, rawDatabase } = await setUp();
    const valid = unwrap(await storage.journal.create(origin, content('Valid')));
    const raw = await rawDatabase();
    await raw.run(
      `INSERT INTO journal_note (local_day, created_at, utc_offset, updated_at, title, body)
       VALUES (?, -5, 0, 0, NULL, 'Bad time'), (?, ?, 0, ?, ' Bad title', 'Text')`,
      [DAY, DAY, AT, AT],
    );
    await raw.close();

    const listed = unwrap(await storage.journal.list());
    expect(listed.map((note) => note.id)).toEqual([valid.id]);
    expect(await storage.journal.get(noteId(valid.id + 1))).toEqual(ok(null));
  });

  it('treats a note that cannot be read as missing when editing it', async () => {
    const { storage, rawDatabase } = await setUp();
    const created = unwrap(await storage.journal.create(origin, content('Text')));
    const raw = await rawDatabase();
    await raw.run('UPDATE journal_note SET updated_at = -1 WHERE id = ?', [created.id]);
    await raw.close();

    expect(await storage.journal.update(created.id, AT, content('New'))).toEqual(err('not-found'));
  });

  it('rolls an edit back when the stored row cannot be read back', async () => {
    const { storage } = await setUp();
    const created = unwrap(await storage.journal.create(origin, content('Text')));

    expect(await storage.journal.update(created.id, -1, content('New'))).toEqual(
      err('storage-failed'),
    );
    expect(await storage.journal.get(created.id)).toEqual(ok(created));
  });

  it('rolls a creation back when the stored row cannot be read back', async () => {
    const { storage } = await setUp();
    expect(await storage.journal.create({ ...origin, at: -1 }, content('Text'))).toEqual(
      err('storage-failed'),
    );
    expect(await storage.journal.list()).toEqual(ok([]));
  });

  it('reports storage failures', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.journal.list()).toEqual(err('storage-failed'));
    expect(await storage.journal.get(noteId(1))).toEqual(err('storage-failed'));
    expect(await storage.journal.create(origin, content('Text'))).toEqual(err('storage-failed'));
    expect(await storage.journal.update(noteId(1), AT, content('Text'))).toEqual(
      err('storage-failed'),
    );
    expect(await storage.journal.remove(noteId(1))).toEqual(err('storage-failed'));
  });
});
