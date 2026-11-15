import type { Migration } from '@/data/migrations/migration';

// One check-in per local day. local_day is the local day number when the check-in was first
// saved, stored rather than derived from recorded_at, so changing time zone never moves a
// check-in to another day. Editing it the same day updates the row and keeps recorded_at.
// The context holds risk moment ids as JSON, like lapse_detail.
export const checkIns: Migration = {
  version: 4,
  async up(tx) {
    await tx.exec(`
      CREATE TABLE check_in (
        id INTEGER PRIMARY KEY,
        local_day INTEGER NOT NULL UNIQUE,
        recorded_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
        urge_level TEXT NOT NULL CHECK (urge_level IN ('none', 'light', 'strong', 'intense')),
        context TEXT NOT NULL,
        note TEXT
      ) STRICT;
    `);
  },
};
