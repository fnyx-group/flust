import type { Migration } from '@/data/migrations/migration';

// Reasons, risk moments and plans are the user's real data, read later by the emergency screen
// and the reasons and plans editor. Each row holds either a preset id, translated on display, or
// the user's own text, never both. The draft is a single row that only lives during the
// onboarding; its answers are JSON because they are validated as a whole on load and discarded
// once the onboarding is finished.
export const onboarding: Migration = {
  version: 2,
  async up(tx) {
    await tx.exec(`
      CREATE TABLE reason (
        id INTEGER PRIMARY KEY,
        position INTEGER NOT NULL,
        preset_id TEXT,
        custom_text TEXT,
        CHECK ((preset_id IS NULL) <> (custom_text IS NULL))
      ) STRICT;

      CREATE UNIQUE INDEX reason_preset ON reason (preset_id) WHERE preset_id IS NOT NULL;

      CREATE TABLE risk_moment (
        preset_id TEXT PRIMARY KEY,
        position INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE plan (
        id INTEGER PRIMARY KEY,
        position INTEGER NOT NULL,
        trigger_id TEXT NOT NULL,
        action_preset_id TEXT,
        action_custom_text TEXT,
        CHECK ((action_preset_id IS NULL) <> (action_custom_text IS NULL))
      ) STRICT;

      CREATE TABLE onboarding_draft (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        step TEXT NOT NULL,
        answers TEXT NOT NULL
      ) STRICT;
    `);
  },
};
