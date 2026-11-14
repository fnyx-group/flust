import type { Migration } from '@/data/migrations/migration';

// Lapse details point at a lapse row by its id, since two lapses can share a time. Foreign keys
// are off on this connection, so deleting a lapse deletes its detail explicitly, in the same
// transaction. recorded_at is when the lapse was logged; rows from before this version have none.
// A plan change is kept with the detail so that undoing the lapse can put the previous plan back;
// a change with no previous plan added one, which undoing removes.
// An urge event is written when the emergency screen opens and completed when it closes, so a
// visit cut short by the app being killed still counts, with no end and no outcome.
export const lapsesAndUrges: Migration = {
  version: 3,
  async up(tx) {
    await tx.exec(`
      ALTER TABLE lapse ADD COLUMN recorded_at INTEGER;

      CREATE TABLE lapse_detail (
        lapse_id INTEGER PRIMARY KEY,
        place_id TEXT,
        context TEXT NOT NULL,
        previous_plan TEXT,
        new_plan TEXT,
        CHECK (previous_plan IS NULL OR new_plan IS NOT NULL)
      ) STRICT;

      CREATE TABLE urge_event (
        id INTEGER PRIMARY KEY,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        outcome TEXT CHECK (outcome IN ('held', 'lapse', 'closed')),
        CHECK ((ended_at IS NULL) = (outcome IS NULL))
      ) STRICT;
    `);
  },
};
