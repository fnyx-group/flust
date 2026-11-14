import { BACKUP_NAME, DATABASE_NAME, type StorageDeps } from '@/data/storage-deps';
import { err, ok, type Result } from '@/domain/result';

export type ResetStorageError = 'reset-failed';

// Storage must be closed first. The backup goes before the database, which would otherwise be
// restored from it on next launch, and the key goes last: a reset stopped halfway then leaves a
// key without a database, which the next launch replaces.
export async function resetStorage(
  deps: Pick<StorageDeps, 'files' | 'keyStore'>,
): Promise<Result<void, ResetStorageError>> {
  try {
    await deps.files.remove(BACKUP_NAME);
    await deps.files.remove(DATABASE_NAME);
    await deps.keyStore.remove();
    return ok(undefined);
  } catch {
    return err('reset-failed');
  }
}
