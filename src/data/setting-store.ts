import type { Executor } from '@/data/database';

// Settings are rows of key and value, written as text. Each repository reads its own keys and
// validates them.
export async function readSetting(db: Executor, key: string): Promise<string | null> {
  const rows = await db.all('SELECT value FROM setting WHERE key = ?', [key]);
  const value = rows[0]?.value;
  return typeof value === 'string' ? value : null;
}

export async function writeSetting(tx: Executor, key: string, value: string): Promise<void> {
  await tx.run(
    `INSERT INTO setting (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export const SETTING_KEYS = {
  language: 'language',
  lowMoodDismissedDay: 'low-mood-dismissed-day',
  reminders: 'reminders',
  lock: 'lock',
  lockAttempts: 'lock-attempts',
  filterRequest: 'filter-request',
} as const;
