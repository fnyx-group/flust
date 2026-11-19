import { getRandomBytesAsync } from 'expo-crypto';

import { errorLog } from '@/data/native/expo-diagnostics';
import { expoDriver } from '@/data/native/expo-driver';
import { expoFiles } from '@/data/native/expo-files';
import { expoKeyStore } from '@/data/native/expo-key-store';
import { createStorageService } from '@/data/storage-service';
import { toEntry } from '@/domain/error-log';

export const storageService = createStorageService({
  keyStore: expoKeyStore,
  randomBytes: getRandomBytesAsync,
  driver: expoDriver,
  files: expoFiles,
  // The kind alone: nothing about the file or its content is recorded.
  onBackupDiscarded: () => {
    void errorLog.record(toEntry({ at: Date.now(), kind: 'backup-discarded' }));
  },
});

export { errorLog, launchGuard } from '@/data/native/expo-diagnostics';
