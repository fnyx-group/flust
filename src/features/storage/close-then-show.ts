import type { Storage } from '@/data/open-storage';
import type { StorageFailure } from '@/features/storage/storage-failure';

// A reset deletes the database file, which must not be open, and a retry opens it again, so
// storage is closed before either is offered. A failure to close changes neither.
export async function closeThenShow(
  storage: Pick<Storage, 'close'>,
  failure: StorageFailure,
  show: (failure: StorageFailure) => void,
): Promise<void> {
  await storage.close().catch(() => undefined);
  show(failure);
}
