import { createContext, use } from 'react';

import type { Storage } from '@/data/open-storage';

export const StorageContext = createContext<Storage | null>(null);

/**
 * The opened storage and its repositories. Only available below StorageGate, which renders its
 * children once storage is open.
 * @public
 */
export function useStorage(): Storage {
  const storage = use(StorageContext);
  if (storage === null) throw new Error('useStorage must be called below StorageGate.');
  return storage;
}
