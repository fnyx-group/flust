import type { Storage } from '@/data/open-storage';
import type { ResetStorageError } from '@/data/reset-storage';
import type { StorageService } from '@/data/storage-service';
import type { Result } from '@/domain/result';

// The database file is deleted, so it must be closed first. A failure to close does not stop the
// erase: the reset reports whether the files are really gone.
export async function eraseAll(
  storage: Pick<Storage, 'close'>,
  service: Pick<StorageService, 'reset'>,
): Promise<Result<void, ResetStorageError>> {
  await storage.close().catch(() => undefined);
  return service.reset();
}
