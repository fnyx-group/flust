import type { Journey } from '@/domain/journey';
import {
  elapsedMs,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  wholeDays,
  type Timestamp,
} from '@/domain/time';

export type StreakDisplay =
  { unit: 'hours'; hours: number; minutes: number } | { unit: 'days'; days: number };

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
