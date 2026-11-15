import { isOneOf } from '@/domain/guards';
import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND, type Timestamp } from '@/domain/time';

// How long the app may stay in the background before it asks again. 0 asks every time.
export const LOCK_DELAYS = [0, MS_PER_MINUTE, 5 * MS_PER_MINUTE, 15 * MS_PER_MINUTE, MS_PER_HOUR];
export type LockDelay = number;
export const isLockDelay = isOneOf(LOCK_DELAYS);

export type LockSettings = { readonly enabled: boolean; readonly delay: LockDelay };

export const DEFAULT_LOCK_SETTINGS: LockSettings = { enabled: false, delay: MS_PER_MINUTE };

// Failed or cancelled unlocks in a row, and the wait still to go before the next one.
export type Attempts = { readonly failures: number; readonly waitMs: number };

export const NO_ATTEMPTS: Attempts = { failures: 0, waitMs: 0 };

// The first two are free, since a prompt closed by mistake is common. Then each attempt waits
// longer, up to an hour.
const WAITS = [
  0,
  0,
  30 * MS_PER_SECOND,
  MS_PER_MINUTE,
  5 * MS_PER_MINUTE,
  15 * MS_PER_MINUTE,
  MS_PER_HOUR,
];

export function waitAfter(failures: number): number {
  if (failures <= 0) return 0;
  return WAITS[Math.min(failures, WAITS.length) - 1] ?? MS_PER_HOUR;
}

export function recordFailure(attempts: Attempts): Attempts {
  const failures = attempts.failures + 1;
  return { failures, waitMs: waitAfter(failures) };
}

// Time only ever shortens the wait, and a negative gap, from a clock set back, counts as none.
export function elapse(attempts: Attempts, ms: number): Attempts {
  return { ...attempts, waitMs: Math.max(0, attempts.waitMs - Math.max(0, ms)) };
}

export function isWaiting(attempts: Attempts): boolean {
  return attempts.waitMs > 0;
}

export type SavedAttempts = { readonly attempts: Attempts; readonly savedAt: Timestamp };

// A restart counts the wall clock's time since the wait was saved. A clock moved back gives no
// credit, so the wait is never reset by a restart. A clock moved forward can shorten it, but
// changing the clock needs the phone unlocked, which already opens the app.
export function resumeAttempts(saved: SavedAttempts, now: Timestamp): Attempts {
  return elapse(saved.attempts, now - saved.savedAt);
}

// Time away is the longer of the monotonic and the wall clock gaps: the monotonic clock can
// stop while the phone sleeps, and moving the wall clock can only make the app lock sooner.
export function timeAway(monotonicGap: number, wallGap: number): number {
  return Math.max(0, monotonicGap, wallGap);
}

export function shouldRelock(settings: LockSettings, awayMs: number): boolean {
  return settings.enabled && awayMs >= settings.delay;
}
