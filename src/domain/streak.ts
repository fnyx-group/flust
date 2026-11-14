import type { Journey } from '@/domain/journey';
import {
  elapsedMs,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  wholeDays,
  type Timestamp,
} from '@/domain/time';

// Every function taking `now` expects a valid timestamp (see isValidTimestamp): NaN is not
// checked and propagates to the result.

export type StreakDisplay =
  { unit: 'hours'; hours: number; minutes: number } | { unit: 'days'; days: number };

// The streak counter shrinks with its number of digits so that it stays on one line.
export type CounterSize = 'large' | 'medium' | 'small';

export type HoursAndMinutes = { hours: number; minutes: number };

export function streakStart(journey: Journey): Timestamp {
  return journey.lapses.at(-1) ?? journey.start;
}

export function currentStreakMs(journey: Journey, now: Timestamp): number {
  return elapsedMs(streakStart(journey), now);
}

export function longestStreakMs(journey: Journey, now: Timestamp): number {
  return Math.max(...segmentsMs(journey, now));
}

// Each segment counts its own whole days, so a lapse costs at most the partial day it interrupts.
export function totalCleanDays(journey: Journey, now: Timestamp): number {
  return segmentsMs(journey, now).reduce((total, segment) => total + wholeDays(segment), 0);
}

export function streakDisplay(streakMs: number): StreakDisplay {
  const ms = Math.max(0, streakMs);
  if (ms >= MS_PER_DAY) return { unit: 'days', days: wholeDays(ms) };
  return {
    unit: 'hours',
    hours: Math.floor(ms / MS_PER_HOUR),
    minutes: Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE),
  };
}

// Minutes always show two digits, so 7 h 05 counts three digits like 7 h 40.
export function counterSize(display: StreakDisplay): CounterSize {
  const digits =
    display.unit === 'days' ? String(display.days).length : String(display.hours).length + 2;
  if (digits <= 2) return 'large';
  if (digits === 3) return 'medium';
  return 'small';
}

// Rounded up to the minute, unlike the elapsed time, so that elapsed and remaining always add up:
// 7 h 40 elapsed shows 16 h 20 left even 30 seconds into that minute.
export function remainingParts(ms: number): HoursAndMinutes {
  const minutes = Math.ceil(Math.max(0, ms) / MS_PER_MINUTE);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

// Points are capped at now so that lapses logged while the clock was ahead add no time.
function segmentsMs(journey: Journey, now: Timestamp): number[] {
  let previous = Math.min(journey.start, now);
  return [...journey.lapses, now].map((point) => {
    const end = Math.min(point, now);
    const segment = elapsedMs(previous, end);
    previous = end;
    return segment;
  });
}
