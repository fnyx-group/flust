import type { Database } from '@/data/database';
import { err, ok, type Result } from '@/domain/result';

export type SettingsStorageError = 'storage-failed';

// The language is stored as written. Storage does not know which languages exist: the feature
// that applies it validates it, and anything unknown reads as no choice.
export type SettingsRepository = {
  loadLanguage(): Promise<Result<string | null, SettingsStorageError>>;
  saveLanguage(language: string): Promise<Result<void, SettingsStorageError>>;
};

const LANGUAGE_KEY = 'language';

export function createSettingsRepository(db: Database): SettingsRepository {
  return {
    async loadLanguage() {
      try {
        const rows = await db.all('SELECT value FROM setting WHERE key = ?', [LANGUAGE_KEY]);
        const value = rows[0]?.value;
        return ok(typeof value === 'string' ? value : null);
      } catch {
        return err('storage-failed');
      }
    },

    async saveLanguage(language) {
      try {
        await db.transaction((tx) =>
          tx.run(
            `INSERT INTO setting (key, value) VALUES (?, ?)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
            [LANGUAGE_KEY, language],
          ),
        );
        return ok(undefined);
      } catch {
        return err('storage-failed');
      }
    },
  };
}
