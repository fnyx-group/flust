import { getRandomBytesAsync } from 'expo-crypto';

import { expoDriver } from '@/data/native/expo-driver';
import { expoFiles } from '@/data/native/expo-files';
import { expoKeyStore } from '@/data/native/expo-key-store';
import { createStorageService } from '@/data/storage-service';

export const storageService = createStorageService({
  keyStore: expoKeyStore,
  randomBytes: getRandomBytesAsync,
  driver: expoDriver,
  files: expoFiles,
});
