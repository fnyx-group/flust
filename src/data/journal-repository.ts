import type { Database, Executor, Row } from '@/data/database';
import {
  parseNote,
  parseNoteSummary,
  type Note,
  type NoteContent,
  type NoteId,
  type NoteSummary,
} from '@/domain/journal';
import { err, ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

export type JournalStorageError = 'storage-failed';

// Where and when a new note is written: the local day and the UTC offset at that moment.
export type NoteOrigin = { readonly day: number; readonly at: Timestamp; readonly offset: number };

export type JournalRepository = {
  // Every note, the latest local day first, each with the start of its text only. Rows that fail
  // validation are left out rather than shown with wrong values.
  list(): Promise<Result<readonly NoteSummary[], JournalStorageError>>;
  // Null when the note does not exist or fails validation.
  get(id: NoteId): Promise<Result<Note | null, JournalStorageError>>;
  create(origin: NoteOrigin, content: NoteContent): Promise<Result<Note, JournalStorageError>>;
  // Keeps the day and time of creation, and moves the time of the last change.
  update(
    id: NoteId,
    at: Timestamp,
    content: NoteContent,
  ): Promise<Result<Note, JournalStorageError | 'not-found'>>;
  // Removing a note that no longer exists succeeds.
  remove(id: NoteId): Promise<Result<void, JournalStorageError>>;
};

// Enough for the few lines the list shows, so hundreds of long notes stay cheap to list.
const EXCERPT_LENGTH = 280;

const COLUMNS = 'id, local_day, created_at, utc_offset, updated_at, title, body';

export function createJournalRepository(db: Database): JournalRepository {
  return {
    async list() {
      try {
        const rows = await db.all(
          `SELECT id, local_day, created_at, title, substr(body, 1, ?) AS excerpt
           FROM journal_note ORDER BY local_day DESC, created_at DESC, id DESC`,
          [EXCERPT_LENGTH],
        );
        return ok(rows.flatMap((row) => toSummary(row) ?? []));
      } catch {
        return err('storage-failed');
      }
    },

    async get(id) {
      try {
        return ok(await select(db, id));
      } catch {
        return err('storage-failed');
      }
    },

    async create(origin, content) {
      try {
        return ok(await db.transaction((tx) => insert(tx, origin, content)));
      } catch {
        return err('storage-failed');
      }
    },

    async update(id, at, content) {
      try {
        const saved = await db.transaction((tx) => change(tx, id, at, content));
        return saved === null ? err('not-found') : ok(saved);
      } catch {
        return err('storage-failed');
      }
    },

    async remove(id) {
      try {
        await db.run('DELETE FROM journal_note WHERE id = ?', [id]);
        return ok(undefined);
      } catch {
        return err('storage-failed');
      }
    },
  };
}

// A row that cannot be read back rolls the write back, so nothing is stored that the app would
// then ignore.
async function insert(tx: Executor, origin: NoteOrigin, content: NoteContent): Promise<Note> {
  await tx.run(
    `INSERT INTO journal_note (local_day, created_at, utc_offset, updated_at, title, body)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [origin.day, origin.at, origin.offset, origin.at, content.title, content.body],
  );
  const rows = await tx.all('SELECT last_insert_rowid() AS id');
  const id = rows[0]?.id;
  const saved = typeof id === 'number' ? await select(tx, id) : null;
  if (saved === null) throw new Error('The new note cannot be read back.');
  return saved;
}

async function change(
  tx: Executor,
  id: NoteId,
  at: Timestamp,
  content: NoteContent,
): Promise<Note | null> {
  if ((await select(tx, id)) === null) return null;
  await tx.run('UPDATE journal_note SET updated_at = ?, title = ?, body = ? WHERE id = ?', [
    at,
    content.title,
    content.body,
    id,
  ]);
  const saved = await select(tx, id);
  if (saved === null) throw new Error('The edited note cannot be read back.');
  return saved;
}

async function select(db: Executor, id: number): Promise<Note | null> {
  const rows = await db.all(`SELECT ${COLUMNS} FROM journal_note WHERE id = ?`, [id]);
  return rows[0] === undefined ? null : toNote(rows[0]);
}

function toNote(row: Row): Note | null {
  const parsed = parseNote({
    id: row.id,
    day: row.local_day,
    createdAt: row.created_at,
    offset: row.utc_offset,
    updatedAt: row.updated_at,
    title: row.title,
    body: row.body,
  });
  return parsed.ok ? parsed.value : null;
}

function toSummary(row: Row): NoteSummary | null {
  const parsed = parseNoteSummary({
    id: row.id,
    day: row.local_day,
    createdAt: row.created_at,
    title: row.title,
    excerpt: row.excerpt,
  });
  return parsed.ok ? parsed.value : null;
}
