import type { Database } from '@/data/database';
import { err, ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';
import type { UrgeOutcome } from '@/domain/urge';

export type UrgeStorageError = 'storage-failed';
export type FinishUrgeError = UrgeStorageError | 'urge-not-open';

// Only the start, the end and the outcome of each visit to the emergency screen are stored.
export type UrgeRepository = {
  start(at: Timestamp): Promise<Result<number, UrgeStorageError>>;
  finish(id: number, at: Timestamp, outcome: UrgeOutcome): Promise<Result<void, FinishUrgeError>>;
};

export function createUrgeRepository(db: Database): UrgeRepository {
  return {
    async start(at) {
      try {
        const id = await db.transaction(async (tx) => {
          await tx.run('INSERT INTO urge_event (started_at) VALUES (?)', [at]);
          const rows = await tx.all('SELECT last_insert_rowid() AS id');
          return rows[0]?.id;
        });
        return typeof id === 'number' ? ok(id) : err('storage-failed');
      } catch {
        return err('storage-failed');
      }
    },

    // A visit ends once: a second outcome for the same visit is refused.
    async finish(id, at, outcome) {
      try {
        const changed = await db.transaction(async (tx) => {
          await tx.run(
            'UPDATE urge_event SET ended_at = ?, outcome = ? WHERE id = ? AND outcome IS NULL',
            [at, outcome, id],
          );
          const rows = await tx.all('SELECT changes() AS count');
          return rows[0]?.count;
        });
        return changed === 1 ? ok(undefined) : err('urge-not-open');
      } catch {
        return err('storage-failed');
      }
    },
  };
}
