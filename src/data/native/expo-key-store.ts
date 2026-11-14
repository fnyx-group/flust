import {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
  type SecureStoreOptions,
} from 'expo-secure-store';

import type { KeyStore } from '@/data/storage-key';

const KEY_NAME = 'database-key';

// Readable after the first unlock so the app can start in the background, and never migrated to
// another device or restored from a backup. Android ignores this option: its keystore entries
// never leave the device.
const options: SecureStoreOptions = { keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const expoKeyStore: KeyStore = {
  get: () => getItemAsync(KEY_NAME, options),
  set: (value) => setItemAsync(KEY_NAME, value, options),
  remove: () => deleteItemAsync(KEY_NAME, options),
};
