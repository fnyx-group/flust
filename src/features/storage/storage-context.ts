import { createContext, use } from 'react';

import type { Storage } from '@/data/open-storage';
import type { StorageFailure } from '@/features/storage/storage-failure';

export const StorageContext = createContext<Storage | null>(null);

export const StorageFailureContext = createContext<((failure: StorageFailure) => void) | null>(
  null,
);

// The opened storage and its repositories. Only available below StorageGate, which renders its
// children once storage is open.
export function useStorage(): Storage {
  const storage = use(StorageContext);
  if (storage === null) throw new Error('useStorage must be called below StorageGate.');
  return storage;
}

// A failure found after storage opened, such as a corrupted journey, goes back to StorageGate:
// it closes storage before showing the failure, since a reset needs storage closed.
export function useReportStorageFailure(): (failure: StorageFailure) => void {
  const report = use(StorageFailureContext);
  if (report === null) {
    throw new Error('useReportStorageFailure must be called below StorageGate.');
  }
  return report;
}
