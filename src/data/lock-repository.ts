import type { Database } from '@/data/database';
import {
  decodeAttempts,
  decodeLockSettings,
  encodeAttempts,
  encodeLockSettings,
} from '@/data/lock-codec';
import { readSetting, SETTING_KEYS, writeSetting } from '@/data/setting-store';
import { NO_ATTEMPTS, resumeAttempts, type Attempts, type LockSettings } from '@/domain/lock';
import { err, ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

export type LockStorageError = 'storage-failed';

export type LockRepository = {
  loadSettings(): Promise<Result<LockSettings, LockStorageError>>;
  saveSettings(settings: LockSettings): Promise<Result<void, LockStorageError>>;
  // The attempts as they stand at `now`, with the time since they were saved taken off the wait.
  loadAttempts(now: Timestamp): Promise<Result<Attempts, LockStorageError>>;
  saveAttempts(attempts: Attempts, now: Timestamp): Promise<Result<void, LockStorageError>>;
};

export function createLockRepository(db: Database): LockRepository {
  async function save(key: string, value: string): Promise<Result<void, LockStorageError>> {
    try {
      await db.transaction((tx) => writeSetting(tx, key, value));
      return ok(undefined);
    } catch {
      return err('storage-failed');
    }
  }

  return {
    async loadSettings() {
      try {
        return ok(decodeLockSettings(await readSetting(db, SETTING_KEYS.lock)));
      } catch {
        return err('storage-failed');
      }
    },
    saveSettings: (settings) => save(SETTING_KEYS.lock, encodeLockSettings(settings)),
    async loadAttempts(now) {
      try {
        const saved = decodeAttempts(await readSetting(db, SETTING_KEYS.lockAttempts));
        return ok(saved === null ? NO_ATTEMPTS : resumeAttempts(saved, now));
      } catch {
        return err('storage-failed');
      }
    },
    saveAttempts: (attempts, now) =>
      save(SETTING_KEYS.lockAttempts, encodeAttempts({ attempts, savedAt: now })),
  };
}
