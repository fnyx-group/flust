import type { LoadJourneyError } from '@/data/journey-repository';
import type { OpenStorageError } from '@/data/open-storage';
import type { ResetStorageError } from '@/data/reset-storage';

export type StorageFailure = OpenStorageError | ResetStorageError | LoadJourneyError;

type PermanentFailure = 'key-missing' | 'database-unreadable' | 'journey-corrupted';

export type FailureScreen =
  | { kind: 'reset'; reason: PermanentFailure }
  | { kind: 'retry'; reason: Exclude<StorageFailure, PermanentFailure> };

// Only data that can never be read correctly again offers a reset: a database that cannot be
// decrypted, or a journey that decrypts but fails validation, which a retry would read the same
// way. Every other failure may be temporary or fixed by an update, and erasing the data there
// would destroy what is still intact.
export function failureScreen(failure: StorageFailure): FailureScreen {
  switch (failure) {
    case 'key-missing':
    case 'database-unreadable':
    case 'journey-corrupted':
      return { kind: 'reset', reason: failure };
    case 'key-unavailable':
    case 'cipher-unavailable':
    case 'schema-too-new':
    case 'migration-failed':
    case 'storage-unavailable':
    case 'reset-failed':
    case 'storage-failed':
      return { kind: 'retry', reason: failure };
  }
}
