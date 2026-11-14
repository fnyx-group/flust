import { addLapse, type AddLapseError, type Journey } from '@/domain/journey';
import { localToUtc, utcToLocal, type UtcOffsetAt } from '@/domain/local-time';
import { samePlan, type Plan } from '@/domain/onboarding';
import type { PlaceId, RiskMomentId } from '@/domain/presets';
import { rankProgress, type Rank, type RankId } from '@/domain/ranks';
import { err, ok, type Result } from '@/domain/result';
import { clampStart, type TimeBounds } from '@/domain/start-point';
import { streakDisplay, streakStart, totalCleanDays, type StreakDisplay } from '@/domain/streak';
import { elapsedMs, floorToMinute, MS_PER_HOUR, type Timestamp } from '@/domain/time';

// The optional answers of the lapse screen. The context uses the risk moment ids, like the
// onboarding and the future check-in, so patterns can be matched across them.
export type LapseDetails = {
  readonly place: PlaceId | null;
  readonly context: readonly RiskMomentId[];
};

export const NO_DETAILS: LapseDetails = { place: null, context: [] };

// Kept with the lapse so that undoing it can put the previous plan back.
export type PlanChange = { readonly previous: Plan; readonly next: Plan };

// A stored lapse. `recordedAt` is when it was logged, which can be later than `at` when it is
// backdated; lapses stored before it existed have none.
export type LapseRecord = {
  readonly id: number;
  readonly at: Timestamp;
  readonly recordedAt: Timestamp | null;
};

export type LogLapseError = AddLapseError | 'lapse-before-last';

export type LapseSummary = {
  readonly totalCleanDays: number;
  readonly endedStreak: StreakDisplay;
  readonly rank: Rank | null;
};

export const SUPPORT_WINDOW_MS = 6 * MS_PER_HOUR;

const MIN_UNDO_WINDOW_MS = MS_PER_HOUR;

const DEFAULT_EARLIER_MS = MS_PER_HOUR;

export function hasDetails(details: LapseDetails): boolean {
  return details.place !== null || details.context.length > 0;
}

// A lapse can be backdated, but never before the last one: the streak that just ended starts
// there.
export function logLapse(
  journey: Journey,
  at: Timestamp,
  now: Timestamp,
): Result<Journey, LogLapseError> {
  const added = addLapse(journey, at, now);
  if (!added.ok) return added;
  const last = journey.lapses.at(-1);
  if (last !== undefined && at < last) return err('lapse-before-last');
  return added;
}

// From the start of the current streak to now, in whole minutes like the start picker. Null when
// the clock is behind the streak start: no time can be picked until it is corrected.
export function lapseBounds(journey: Journey, now: Timestamp): TimeBounds | null {
  const min = streakStart(journey);
  if (now < min) return null;
  return { min, max: Math.max(min, floorToMinute(now)) };
}

export function defaultEarlierLapse(bounds: TimeBounds): Timestamp {
  return clampStart(bounds.max - DEFAULT_EARLIER_MS, bounds);
}

// Computed with the lapse at its chosen time, so a backdated lapse shows the total it really
// leaves. The rank comes from the stored ranks as well as the total, so it is never lower.
export function lapseSummary(
  journey: Journey,
  at: Timestamp,
  unlockedRanks: readonly RankId[],
  now: Timestamp,
): Result<LapseSummary, LogLapseError> {
  const after = logLapse(journey, at, now);
  if (!after.ok) return err(after.error);
  const total = totalCleanDays(after.value, now);
  return ok({
    totalCleanDays: total,
    endedStreak: streakDisplay(elapsedMs(streakStart(journey), at)),
    rank: rankProgress(unlockedRanks, total).current,
  });
}

// The hours after a lapse is logged, when home shows a supportive line and no unlock screen.
export function inSupportWindow(record: LapseRecord | null, now: Timestamp): boolean {
  if (record === null || record.recordedAt === null) return false;
  return withinWindow(record.recordedAt, record.recordedAt + SUPPORT_WINDOW_MS, now);
}

// Until the local midnight after it was logged, and never less than an hour.
export function undoDeadline(recordedAt: Timestamp, offsetAt: UtcOffsetAt): Timestamp {
  const { year, month, day } = utcToLocal(recordedAt, offsetAt);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const midnight = localToUtc(
    {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    offsetAt,
  );
  const endOfDay = midnight.ok ? midnight.value : recordedAt;
  return Math.max(endOfDay, recordedAt + MIN_UNDO_WINDOW_MS);
}

export function canUndo(record: LapseRecord | null, now: Timestamp, offsetAt: UtcOffsetAt) {
  if (record === null || record.recordedAt === null) return false;
  return withinWindow(record.recordedAt, undoDeadline(record.recordedAt, offsetAt), now);
}

// The plan in place before the lapse comes back only if the plan is still the one the lapse set:
// a plan edited since then is the user's newer choice.
export function planToRestore(change: PlanChange | null, current: Plan | null): Plan | null {
  if (change === null || current === null) return null;
  return samePlan(change.next, current) ? change.previous : null;
}

// A clock set back by more than the window's length ends it, so a lapse logged while the clock
// was far ahead never keeps the window open for days once the clock is corrected.
function withinWindow(start: Timestamp, end: Timestamp, now: Timestamp): boolean {
  return now < end && now > start - (end - start);
}
