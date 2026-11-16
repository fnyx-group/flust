import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytesAsync,
} from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

import { createErrorLog, type BinaryFile, type SealedBox } from '@/data/error-log-store';
import { createLaunchGuard, type TextFile } from '@/data/launch-guard';
import { createExpoKeyStore } from '@/data/native/expo-key-store';

const LOG_NAME = 'diagnostics.bin';
const LOG_TEMPORARY_NAME = 'diagnostics.bin.tmp';
const LAUNCH_NAME = 'launch-attempts';

const aesBox: SealedBox = {
  async seal(plain, key) {
    const sealed = await aesEncryptAsync(plain, await AESEncryptionKey.import(key, 'hex'));
    return sealed.combined();
  },
  async open(sealed, key) {
    const data = AESSealedData.fromCombined(sealed);
    return aesDecryptAsync(data, await AESEncryptionKey.import(key, 'hex'));
  },
};

function documentFile(name: string): File {
  return new File(Paths.document, name);
}

function remove(name: string): void {
  const file = documentFile(name);
  if (file.exists) file.delete();
}

// Written next to the log, then moved over it, so a write cut short keeps the previous log.
const logFile: BinaryFile = {
  async read() {
    const file = documentFile(LOG_NAME);
    return file.exists ? file.bytes() : null;
  },
  async write(bytes) {
    const temporary = documentFile(LOG_TEMPORARY_NAME);
    if (!temporary.exists) temporary.create();
    await temporary.write(bytes);
    await temporary.move(documentFile(LOG_NAME), { overwrite: true });
  },
  async remove() {
    remove(LOG_TEMPORARY_NAME);
    remove(LOG_NAME);
  },
};

const launchFile: TextFile = {
  async read() {
    const file = documentFile(LAUNCH_NAME);
    return file.exists ? file.text() : null;
  },
  async write(text) {
    const file = documentFile(LAUNCH_NAME);
    if (!file.exists) file.create();
    await file.write(text);
  },
  async remove() {
    remove(LAUNCH_NAME);
  },
};

export const errorLog = createErrorLog({
  keyStore: createExpoKeyStore('diagnostics-key'),
  randomBytes: getRandomBytesAsync,
  box: aesBox,
  file: logFile,
});

export const launchGuard = createLaunchGuard(launchFile);
