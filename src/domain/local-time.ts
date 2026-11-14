import { err, ok, type Result } from '@/domain/result';
import { isValidTimestamp, MS_PER_DAY, MS_PER_MINUTE, type Timestamp } from '@/domain/time';

// A wall clock date and time, as the user reads it. Months and days start at 1.
export type LocalDateTime = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
};

// The UTC offset of a time zone at a given instant, in minutes east of UTC. Passed in so that
// domain code never reads the device time zone.
export type UtcOffsetAt = (utc: Timestamp) => number;

export type LocalToUtcError = 'invalid-local-date-time';

// Days in Date.UTC fields start at 0 for Sunday; expo-localization numbers them from 1.
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const MIN_YEAR = 1970;
const MAX_YEAR = 9999;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidLocalDateTime(local: LocalDateTime): boolean {
  const { year, month, day, hour, minute } = local;
  return (
    [year, month, day, hour, minute].every(Number.isInteger) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

// A wall time can happen twice when clocks go back, or never when they go forward. Like
// Temporal's 'compatible' disambiguation, a repeated time resolves to its first occurrence and a
// skipped time moves forward by the length of the gap, so 02:30 in a 02:00 to 03:00 gap is 03:30.
// Offsets are read a day either side, which assumes at most one transition within two days.
export function localToUtc(
  local: LocalDateTime,
  offsetAt: UtcOffsetAt,
): Result<Timestamp, LocalToUtcError> {
  if (!isValidLocalDateTime(local)) return err('invalid-local-date-time');
  const wall = wallAsUtc(local);
  const offsetBefore = offsetAt(wall - MS_PER_DAY);
  const offsetAfter = offsetAt(wall + MS_PER_DAY);
  const matching = [offsetBefore, offsetAfter]
    .map((offset) => wall - offset * MS_PER_MINUTE)
    .filter((candidate) => wall - offsetAt(candidate) * MS_PER_MINUTE === candidate);
  const utc = matching.length > 0 ? Math.min(...matching) : wall - offsetBefore * MS_PER_MINUTE;
  return isValidTimestamp(utc) ? ok(utc) : err('invalid-local-date-time');
}

export function utcToLocal(utc: Timestamp, offsetAt: UtcOffsetAt): LocalDateTime {
  const shifted = new Date(utc + offsetAt(utc) * MS_PER_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

// The days of a month laid out in weeks, with null for the cells before the first day and after
// the last one.
export function monthGrid(year: number, month: number, firstWeekday: Weekday): (number | null)[] {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 1;
  const leading = (firstDay - firstWeekday + 7) % 7;
  const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1);
  const trailing = (7 - ((leading + days.length) % 7)) % 7;
  return [...Array<null>(leading).fill(null), ...days, ...Array<null>(trailing).fill(null)];
}

export function addMonths(
  { year, month }: { year: number; month: number },
  count: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function wallAsUtc({ year, month, day, hour, minute }: LocalDateTime): number {
  return Date.UTC(year, month - 1, day, hour, minute);
}
