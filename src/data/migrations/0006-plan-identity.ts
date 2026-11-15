import type { Migration } from '@/data/migrations/migration';

// Plans become editable, so an undo can no longer find the plan a lapse changed by taking the
// first one: the row it wrote is kept by id. Until this version only a lapse changed plans, and
// always through the first row, so that row is the one every earlier change wrote. An undo still
// checks the row holds the plan the lapse set before touching it.
export const planIdentity: Migration = {
  version: 6,
  async up(tx) {
    await tx.exec(`
      ALTER TABLE lapse_detail ADD COLUMN plan_id INTEGER;
      UPDATE lapse_detail
        SET plan_id = (SELECT id FROM plan ORDER BY position, id LIMIT 1)
        WHERE new_plan IS NOT NULL;
    `);
  },
};
