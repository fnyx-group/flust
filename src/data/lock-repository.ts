import type { Database } from '@/data/database';
import {
  decodeAttempts,
  decodeLockSettings,
  encodeAttempts,
  encodeLockSettings,
} from '@/data/lock-codec';
import { readSetting, SETTING_KEYS, writeSetting } from '@/data/setting-store';
import { attempt, type StorageError } from '@/data/storage-error';
import { NO_ATTEMPTS, resumeAttempts, type Attempts, type LockSettings } from '@/domain/lock';
import { ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

export type LockStorageError = StorageError;

export type LockRepository = {
  loadSettings(): Promise<Result<LockSettings, LockStorageError>>;
  saveSettings(settings: LockSettings): Promise<Result<void, LockStorageError>>;
  // The attempts as they stand at `now`, with the time since they were saved taken off the wait.
  loadAttempts(now: Timestamp): Promise<Result<Attempts, LockStorageError>>;
  saveAttempts(attempts: Attempts, now: Timestamp): Promise<Result<void, LockStorageError>>;
};

export function createLockRepository(db: Database): LockRepository {
  function save(key: string, value: string): Promise<Result<void, LockStorageError>> {
    return attempt(async () => {
      await db.transaction((tx) => writeSetting(tx, key, value));
      return ok(undefined);
    });
  }

  return {
    loadSettings: () =>
      attempt(async () => ok(decodeLockSettings(await readSetting(db, SETTING_KEYS.lock)))),
    saveSettings: (settings) => save(SETTING_KEYS.lock, encodeLockSettings(settings)),
    loadAttempts: (now) =>
      attempt(async () => {
        const saved = decodeAttempts(await readSetting(db, SETTING_KEYS.lockAttempts));
        return ok(saved === null ? NO_ATTEMPTS : resumeAttempts(saved, now));
      }),
    saveAttempts: (attempts, now) =>
      save(SETTING_KEYS.lockAttempts, encodeAttempts({ attempts, savedAt: now })),
  };
}
