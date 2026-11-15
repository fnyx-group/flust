import { isRecord, parseJson } from '@/data/json-codec';
import {
  DEFAULT_LOCK_SETTINGS,
  isLockDelay,
  type Attempts,
  type LockSettings,
  type SavedAttempts,
} from '@/domain/lock';
import { isValidTimestamp, MS_PER_HOUR } from '@/domain/time';

export function encodeLockSettings(settings: LockSettings): string {
  return JSON.stringify(settings);
}

// An unreadable value keeps the lock on when it says so: only a clear "enabled: false" turns it
// off, so damage never opens the app without asking.
export function decodeLockSettings(text: string | null): LockSettings {
  const value = parseJson(text);
  if (!isRecord(value)) return text === null ? DEFAULT_LOCK_SETTINGS : lockedDefault();
  return {
    enabled: value.enabled !== false,
    delay: isLockDelay(value.delay) ? value.delay : DEFAULT_LOCK_SETTINGS.delay,
  };
}

function lockedDefault(): LockSettings {
  return { ...DEFAULT_LOCK_SETTINGS, enabled: true };
}

export function encodeAttempts(saved: SavedAttempts): string {
  return JSON.stringify({ ...saved.attempts, savedAt: saved.savedAt });
}

// The value lives in the encrypted database and cannot be edited from outside, so damage is a
// bug: it reads as no attempts rather than locking the person out.
export function decodeAttempts(text: string | null): SavedAttempts | null {
  const value = parseJson(text);
  if (!isRecord(value)) return null;
  const { failures, waitMs, savedAt } = value;
  if (!isCount(failures) || !isCount(waitMs) || waitMs > MS_PER_HOUR) return null;
  if (typeof savedAt !== 'number' || !isValidTimestamp(savedAt)) return null;
  const attempts: Attempts = { failures, waitMs };
  return { attempts, savedAt };
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
