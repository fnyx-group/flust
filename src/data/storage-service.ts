import type { Migration } from '@/data/migrations/migration';
import { openStorage, type OpenStorageError, type Storage } from '@/data/open-storage';
import { resetStorage, type ResetStorageError } from '@/data/reset-storage';
import type { StorageDeps } from '@/data/storage-deps';
import type { Result } from '@/domain/result';

export type StorageService = {
  open(): Promise<Result<Storage, OpenStorageError>>;
  reset(): Promise<Result<void, ResetStorageError>>;
};

// Two opens running at once on a first launch would each create a key, and the database could
// end up encrypted with the one that was overwritten. Concurrent calls share the same open.
export function createStorageService(
  deps: StorageDeps,
  migrations?: readonly Migration[],
): StorageService {
  let opening: Promise<Result<Storage, OpenStorageError>> | null = null;
  return {
    open() {
      opening ??= openStorage(deps, migrations).finally(() => {
        opening = null;
      });
      return opening;
    },
    reset: () => resetStorage(deps),
  };
}
