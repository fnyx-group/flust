import type { Database } from '@/data/database';
import { readSetting, SETTING_KEYS, writeSetting } from '@/data/setting-store';
import { attempt, type StorageError } from '@/data/storage-error';
import { ok, type Result } from '@/domain/result';

export type SettingsStorageError = StorageError;

// The language is stored as written. Storage does not know which languages exist: the feature
// that applies it validates it, and anything unknown reads as no choice.
export type SettingsRepository = {
  loadLanguage(): Promise<Result<string | null, SettingsStorageError>>;
  saveLanguage(language: string): Promise<Result<void, SettingsStorageError>>;
  // The local day the low mood card was closed on, or null when it never was or the value
  // cannot be read.
  loadLowMoodDismissedDay(): Promise<Result<number | null, SettingsStorageError>>;
  saveLowMoodDismissedDay(day: number): Promise<Result<void, SettingsStorageError>>;
};

export function createSettingsRepository(db: Database): SettingsRepository {
  function load(key: string): Promise<Result<string | null, SettingsStorageError>> {
    return attempt(async () => ok(await readSetting(db, key)));
  }

  function save(key: string, value: string): Promise<Result<void, SettingsStorageError>> {
    return attempt(async () => {
      await db.transaction((tx) => writeSetting(tx, key, value));
      return ok(undefined);
    });
  }

  return {
    loadLanguage: () => load(SETTING_KEYS.language),
    saveLanguage: (language) => save(SETTING_KEYS.language, language),
    async loadLowMoodDismissedDay() {
      const value = await load(SETTING_KEYS.lowMoodDismissedDay);
      return value.ok ? ok(parseDay(value.value)) : value;
    },
    saveLowMoodDismissedDay: (day) => save(SETTING_KEYS.lowMoodDismissedDay, String(day)),
  };
}

function parseDay(value: string | null): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const day = Number(value);
  return Number.isSafeInteger(day) ? day : null;
}
