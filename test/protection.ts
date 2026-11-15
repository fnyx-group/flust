import { DEFAULT_LOCK_SETTINGS } from '@/domain/lock';
import { DEFAULT_REMINDER_SETTINGS } from '@/domain/reminders';

// The settings an onboarding stores when the lock and the reminder were left off.
export const NO_PROTECTION_SETTINGS = {
  lock: DEFAULT_LOCK_SETTINGS,
  reminders: DEFAULT_REMINDER_SETTINGS,
} as const;
