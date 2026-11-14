import { createDatabase, type Database } from '@/data/database';
import { DATABASE_NAME, type StorageDeps } from '@/data/storage-deps';
import { isStorageKey } from '@/data/storage-key';

import { createFakeDisk, type FakeDiskOptions } from './fake-disk';
import { createFakeKeyStore, createFakeRandomBytes } from './fake-key-store';

export function createFakeStorage(options?: FakeDiskOptions) {
  const disk = createFakeDisk(options);
  const keyStore = createFakeKeyStore();
  const randomBytes = createFakeRandomBytes();
  const deps: StorageDeps = { keyStore, randomBytes, driver: disk.driver, files: disk.files };

  // A second connection to the database, keyed like the app's, to set up or inspect rows.
  async function rawDatabase(): Promise<Database> {
    if (!isStorageKey(keyStore.value)) throw new Error('No valid key in the fake key store');
    return createDatabase(await disk.driver.open(DATABASE_NAME, keyStore.value));
  }

  return { disk, keyStore, randomBytes, deps, rawDatabase };
}
