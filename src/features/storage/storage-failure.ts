import type { OpenStorageError } from '@/data/open-storage';
import type { ResetStorageError } from '@/data/reset-storage';

export type StorageFailure = OpenStorageError | ResetStorageError;

export type FailureScreen =
  | { kind: 'reset'; reason: 'key-missing' | 'database-unreadable' }
  | {
      kind: 'retry';
      reason: Exclude<StorageFailure, 'key-missing' | 'database-unreadable'>;
    };

// Only a database that can never be decrypted again offers a reset. Every other failure may be
// temporary or fixed by an update, and erasing the data there would destroy what is still intact.
export function failureScreen(failure: StorageFailure): FailureScreen {
  switch (failure) {
    case 'key-missing':
    case 'database-unreadable':
      return { kind: 'reset', reason: failure };
    case 'key-unavailable':
    case 'cipher-unavailable':
    case 'schema-too-new':
    case 'migration-failed':
    case 'storage-unavailable':
    case 'reset-failed':
      return { kind: 'retry', reason: failure };
  }
}
