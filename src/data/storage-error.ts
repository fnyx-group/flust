import { err, type Result } from '@/domain/result';

export type StorageError = 'storage-failed';

// Repositories never reject: an error thrown by the database becomes 'storage-failed'. Callers
// can then leave their promises unawaited with `void`.
export async function attempt<T, E>(
  task: () => Promise<Result<T, E>>,
): Promise<Result<T, E | StorageError>> {
  try {
    return await task();
  } catch {
    return err('storage-failed');
  }
}
