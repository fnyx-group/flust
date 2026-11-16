import {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
  type SecureStoreOptions,
} from 'expo-secure-store';

import type { KeyStore } from '@/data/storage-key';

// Readable after the first unlock so the app can start in the background, and never migrated to
// another device or restored from a backup. Android ignores this option: its keystore entries
// never leave the device.
const options: SecureStoreOptions = { keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export function createExpoKeyStore(name: string): KeyStore {
  return {
    get: () => getItemAsync(name, options),
    set: (value) => setItemAsync(name, value, options),
    remove: () => deleteItemAsync(name, options),
  };
}

export const expoKeyStore = createExpoKeyStore('database-key');
