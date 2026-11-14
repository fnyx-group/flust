import type { Database } from '@/data/database';
import { err, ok, type Result } from '@/domain/result';
import { isLanguage, type Language } from '@/lib/i18n/language';

export type SettingsStorageError = 'storage-failed';

export type SettingsRepository = {
  loadLanguage(): Promise<Result<Language | null, SettingsStorageError>>;
  saveLanguage(language: Language): Promise<Result<void, SettingsStorageError>>;
};

const LANGUAGE_KEY = 'language';

export function createSettingsRepository(db: Database): SettingsRepository {
  return {
    // An unknown value reads as no choice, so the device language applies again.
    async loadLanguage() {
      try {
        const rows = await db.all('SELECT value FROM setting WHERE key = ?', [LANGUAGE_KEY]);
        const value = rows[0]?.value;
        return ok(isLanguage(value) ? value : null);
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
