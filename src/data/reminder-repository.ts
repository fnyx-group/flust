import type { Database } from '@/data/database';
import { decodeReminderSettings, encodeReminderSettings } from '@/data/reminder-settings-codec';
import { readSetting, SETTING_KEYS, writeSetting } from '@/data/setting-store';
import type { ReminderSettings } from '@/domain/reminders';
import { err, ok, type Result } from '@/domain/result';

export type ReminderStorageError = 'storage-failed';

export type ReminderRepository = {
  load(): Promise<Result<ReminderSettings, ReminderStorageError>>;
  save(settings: ReminderSettings): Promise<Result<void, ReminderStorageError>>;
};

export function createReminderRepository(db: Database): ReminderRepository {
  return {
    async load() {
      try {
        return ok(decodeReminderSettings(await readSetting(db, SETTING_KEYS.reminders)));
      } catch {
        return err('storage-failed');
      }
    },
    async save(settings) {
      try {
        await db.transaction((tx) =>
          writeSetting(tx, SETTING_KEYS.reminders, encodeReminderSettings(settings)),
        );
        return ok(undefined);
      } catch {
        return err('storage-failed');
      }
    },
  };
}
