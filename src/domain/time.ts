export type Timestamp = number;

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
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

// The delay until the time elapsed since `anchor` next reaches a whole period, so that a counter
// started at the anchor changes on its own seconds or minutes rather than on the wall clock's.
export function msUntilNextTick(now: Timestamp, anchor: Timestamp, periodMs: number): number {
  const intoPeriod = (((now - anchor) % periodMs) + periodMs) % periodMs;
  return periodMs - intoPeriod;
}

export function floorToMinute(at: Timestamp): Timestamp {
  return Math.floor(at / MS_PER_MINUTE) * MS_PER_MINUTE;
}
