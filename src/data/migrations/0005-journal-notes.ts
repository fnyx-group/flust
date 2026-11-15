import type { Migration } from '@/data/migrations/migration';

// local_day and utc_offset are taken when a note is first saved and never recomputed, so a note
// keeps the day and the time it was written at after travel. Editing a note only moves
// updated_at. An empty title is stored as NULL and the text is never empty. Length limits are
// checked in the domain, in UTF-16 units.
export const journalNotes: Migration = {
  version: 5,
  async up(tx) {
    await tx.exec(`
      CREATE TABLE journal_note (
        id INTEGER PRIMARY KEY,
        local_day INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        utc_offset INTEGER NOT NULL CHECK (utc_offset BETWEEN -1080 AND 1080),
        updated_at INTEGER NOT NULL,
        title TEXT CHECK (title IS NULL OR length(title) > 0),
        body TEXT NOT NULL CHECK (length(body) > 0)
      ) STRICT;
      CREATE INDEX journal_note_by_day ON journal_note (local_day DESC, created_at DESC, id DESC);
    `);
  },
};
