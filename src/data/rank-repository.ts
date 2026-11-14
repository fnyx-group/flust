import type { Database } from '@/data/database';
import { isRankId, type RankId } from '@/domain/ranks';
import { err, ok, type Result } from '@/domain/result';

export type RankStorageError = 'storage-failed';

export type RankRepository = {
  loadUnlocked(): Promise<Result<RankId[], RankStorageError>>;
  unlock(ids: readonly RankId[]): Promise<Result<void, RankStorageError>>;
};

// There is no way to lock a rank again: an unlocked rank is never lost.
export function createRankRepository(db: Database): RankRepository {
  return {
    // Unknown ids are dropped rather than reported: rankProgress fills any gap they leave.
    async loadUnlocked() {
      try {
        const rows = await db.all('SELECT rank_id FROM unlocked_rank');
        return ok(rows.map((row) => row.rank_id).filter(isRankId));
      } catch {
        return err('storage-failed');
      }
    },

    async unlock(ids) {
      try {
        await db.transaction(async (tx) => {
          for (const id of ids) {
            await tx.run('INSERT OR IGNORE INTO unlocked_rank (rank_id) VALUES (?)', [id]);
          }
        });
        return ok(undefined);
      } catch {
        return err('storage-failed');
      }
    },
  };
}
