import { daysInMonth, localToUtc, utcToLocal, type UtcOffsetAt } from '@/domain/local-time';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, type Timestamp } from '@/domain/time';

export type StartBounds = { readonly min: Timestamp; readonly max: Timestamp };

// About ten years, which covers anyone counting from a long time ago without an endless calendar.
const MAX_START_AGE_MS = 3653 * MS_PER_DAY;

const MINUTE_STEP = 5;

// The picker works in whole minutes, so the latest choice is the start of the current minute.
export function startBounds(now: Timestamp): StartBounds {
  const max = floorToMinute(now);
  return { min: max - MAX_START_AGE_MS, max };
}

export function clampStart(at: Timestamp, { min, max }: StartBounds): Timestamp {
  return Math.min(max, Math.max(min, floorToMinute(at)));
}

export function defaultPastStart(bounds: StartBounds): Timestamp {
  return clampStart(bounds.max - MS_PER_DAY, bounds);
}

// Keeps the time of day when the user picks another day. A day shorter than the selected one,
// or a time skipped by a clock change, resolves to the nearest valid time.
export function selectDay(
  selected: Timestamp,
  date: { year: number; month: number; day: number },
  offsetAt: UtcOffsetAt,
  bounds: StartBounds,
): Timestamp {
  const { hour, minute } = utcToLocal(selected, offsetAt);
  const day = Math.min(date.day, daysInMonth(date.year, date.month));
  const utc = localToUtc({ ...date, day, hour, minute }, offsetAt);
  return utc.ok ? clampStart(utc.value, bounds) : selected;
}

// Steps move along real time rather than the wall clock, so that a clock change never leaves
// the user unable to step past an hour that was skipped or repeated.
export function stepHour(selected: Timestamp, steps: number, bounds: StartBounds): Timestamp {
  return clampStart(selected + steps * MS_PER_HOUR, bounds);
}

// The first step lands on a multiple of five minutes. Every offset in use is a multiple of 15
// minutes, so aligning in UTC also aligns the wall clock.
export function stepMinute(selected: Timestamp, steps: number, bounds: StartBounds): Timestamp {
  const size = MINUTE_STEP * MS_PER_MINUTE;
  const aligned = (steps > 0 ? Math.floor : Math.ceil)(selected / size) * size;
  return clampStart(aligned + steps * size, bounds);
}

export function isDaySelectable(
  date: { year: number; month: number; day: number },
  offsetAt: UtcOffsetAt,
  { min, max }: StartBounds,
): boolean {
  const dayStart = localToUtc({ ...date, hour: 0, minute: 0 }, offsetAt);
  const dayEnd = localToUtc({ ...date, hour: 23, minute: 59 }, offsetAt);
  return dayStart.ok && dayEnd.ok && dayStart.value <= max && dayEnd.value >= min;
}

function floorToMinute(at: Timestamp): Timestamp {
  return Math.floor(at / MS_PER_MINUTE) * MS_PER_MINUTE;
}
