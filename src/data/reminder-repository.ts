import type { Database } from '@/data/database';
import { decodeReminderSettings, encodeReminderSettings } from '@/data/reminder-settings-codec';
import { readSetting, SETTING_KEYS, writeSetting } from '@/data/setting-store';
import { attempt, type StorageError } from '@/data/storage-error';
import type { ReminderSettings } from '@/domain/reminders';
import { ok, type Result } from '@/domain/result';

export type ReminderStorageError = StorageError;

export type ReminderRepository = {
  load(): Promise<Result<ReminderSettings, ReminderStorageError>>;
  save(settings: ReminderSettings): Promise<Result<void, ReminderStorageError>>;
};

export function createReminderRepository(db: Database): ReminderRepository {
  return {
    load: () =>
      attempt(async () =>
        ok(decodeReminderSettings(await readSetting(db, SETTING_KEYS.reminders))),
      ),
    save: (settings) =>
      attempt(async () => {
        await db.transaction((tx) =>
          writeSetting(tx, SETTING_KEYS.reminders, encodeReminderSettings(settings)),
        );
        return ok(undefined);
      }),
  };
}
