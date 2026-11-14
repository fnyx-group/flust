import type { Migration } from '@/data/migrations/migration';

// Timestamps are UTC milliseconds. Lapses are not unique: the domain allows two at the same time.
export const initial: Migration = {
  version: 1,
  async up(tx) {
    await tx.exec(`
      CREATE TABLE journey (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        start_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE lapse (
        id INTEGER PRIMARY KEY,
        at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE unlocked_rank (
        rank_id TEXT PRIMARY KEY
      ) STRICT;

      CREATE TABLE setting (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
    `);
  },
};
