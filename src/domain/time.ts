export type Timestamp = number;

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// The largest timestamp a JavaScript Date can represent.
const MAX_DATE_MS = 8.64e15;

export function isValidTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_DATE_MS;
}

// A clock moved backwards must never produce a negative duration.
// Callers must pass valid timestamps: NaN is not checked and propagates.
export function elapsedMs(from: Timestamp, to: Timestamp): number {
  return Math.max(0, to - from);
}

export function wholeDays(ms: number): number {
  return Math.floor(Math.max(0, ms) / MS_PER_DAY);
}
