import { isRecord, parseJson } from '@/data/json-codec';
import {
  DEFAULT_REMINDER_SETTINGS,
  isMinuteOfDay,
  type ReminderSettings,
} from '@/domain/reminders';

export function encodeReminderSettings(settings: ReminderSettings): string {
  return JSON.stringify(settings);
}

// Corrupted settings fall back to their defaults field by field, so a damaged value turns a
// reminder off rather than blocking the app.
export function decodeReminderSettings(text: string | null): ReminderSettings {
  const value = parseJson(text);
  const defaults = DEFAULT_REMINDER_SETTINGS;
  if (!isRecord(value)) return defaults;
  return {
    checkIn: decodeTimed(value.checkIn, defaults.checkIn),
    thought: decodeTimed(value.thought, defaults.thought),
    riskHours: value.riskHours === true,
    ranks: value.ranks === true,
    checkInSince: Number.isSafeInteger(value.checkInSince) ? Number(value.checkInSince) : null,
  };
}

function decodeTimed(
  value: unknown,
  fallback: ReminderSettings['checkIn'],
): ReminderSettings['checkIn'] {
  if (!isRecord(value)) return fallback;
  return {
    on: value.on === true,
    minute: isMinuteOfDay(value.minute) ? value.minute : fallback.minute,
  };
}
