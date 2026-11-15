import type { Database } from '@/data/database';
import { err, ok, type Result } from '@/domain/result';

export type SettingsStorageError = 'storage-failed';

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

const LANGUAGE_KEY = 'language';
const LOW_MOOD_DISMISSED_KEY = 'low-mood-dismissed-day';

export function createSettingsRepository(db: Database): SettingsRepository {
  async function load(key: string): Promise<Result<string | null, SettingsStorageError>> {
    try {
      const rows = await db.all('SELECT value FROM setting WHERE key = ?', [key]);
      const value = rows[0]?.value;
      return ok(typeof value === 'string' ? value : null);
    } catch {
      return err('storage-failed');
    }
  }

  async function save(key: string, value: string): Promise<Result<void, SettingsStorageError>> {
    try {
      await db.transaction((tx) =>
        tx.run(
          `INSERT INTO setting (key, value) VALUES (?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
          [key, value],
        ),
      );
      return ok(undefined);
    } catch {
      return err('storage-failed');
    }
  }

  return {
    loadLanguage: () => load(LANGUAGE_KEY),
    saveLanguage: (language) => save(LANGUAGE_KEY, language),
    async loadLowMoodDismissedDay() {
      const value = await load(LOW_MOOD_DISMISSED_KEY);
      return value.ok ? ok(parseDay(value.value)) : value;
    },
    saveLowMoodDismissedDay: (day) => save(LOW_MOOD_DISMISSED_KEY, String(day)),
  };
}

function parseDay(value: string | null): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const day = Number(value);
  return Number.isSafeInteger(day) ? day : null;
}
