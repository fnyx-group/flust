export type Timestamp = number;

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export function isValidTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

// A clock moved backwards must never produce a negative duration.
export function elapsedMs(from: Timestamp, to: Timestamp): number {
  return Math.max(0, to - from);
}

export function wholeDays(ms: number): number {
  return Math.floor(Math.max(0, ms) / MS_PER_DAY);
}
