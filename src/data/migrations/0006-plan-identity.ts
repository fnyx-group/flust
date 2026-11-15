import { decodeAction } from '@/data/json-codec';
import type { Migration } from '@/data/migrations/migration';
import { isPlanTrigger } from '@/domain/presets';

// Plans become editable, so an undo can no longer find the plan a lapse changed by taking the
// first one: the row it wrote is kept by id. Until this version only a lapse changed plans, and
// always through the first readable row, so that row is the one every earlier change wrote. A
// damaged row before it was skipped then and is skipped here too. An undo still checks the row
// holds the plan the lapse set before touching it.
export const planIdentity: Migration = {
  version: 6,
  async up(tx) {
    await tx.exec('ALTER TABLE lapse_detail ADD COLUMN plan_id INTEGER');
    const rows = await tx.all(
      `SELECT id, trigger_id, action_preset_id, action_custom_text FROM plan ORDER BY position, id`,
    );
    const first = rows.find((row): row is typeof row & { id: number } => {
      const action =
        row.action_preset_id === null
          ? decodeAction({ kind: 'custom', text: row.action_custom_text })
          : decodeAction({ kind: 'preset', id: row.action_preset_id });
      return isPlanTrigger(row.trigger_id) && action !== null && typeof row.id === 'number';
    });
    if (first === undefined) return;
    await tx.run('UPDATE lapse_detail SET plan_id = ? WHERE new_plan IS NOT NULL', [first.id]);
  },
};
