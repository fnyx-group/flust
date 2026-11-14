import type { Journey } from '@/domain/journey';
import { localDayNumber, type UtcOffsetAt } from '@/domain/local-time';

export type WeekDayStatus = 'clean' | 'today' | 'lapse' | 'before-start';

// `day` is a local day number (see localDayNumber), from which the weekday is formatted.
export type WeekDay = { readonly day: number; readonly status: WeekDayStatus };

const WEEK_LENGTH = 7;

// The last seven local days, oldest first and today last. A past day is clean from the journey's
// first local day on, unless a lapse was logged that day; the day the journey starts counts, like
// the first quote. Today is still in progress until a lapse is logged. Days before the first local
// day are kept apart from lapses, so the first week fills up day by day instead of looking lapsed;
// a clock set before the start puts today there too.
export function weekStrip(journey: Journey, today: number, offsetAt: UtcOffsetAt): WeekDay[] {
  const firstDay = localDayNumber(journey.start, offsetAt);
  const lapseDays = new Set(journey.lapses.map((lapse) => localDayNumber(lapse, offsetAt)));
  return Array.from({ length: WEEK_LENGTH }, (_, index) => {
    const day = today - (WEEK_LENGTH - 1) + index;
    return { day, status: dayStatus(day, today, firstDay, lapseDays) };
  });
}

function dayStatus(
  day: number,
  today: number,
  firstDay: number,
  lapseDays: ReadonlySet<number>,
): WeekDayStatus {
  if (day < firstDay) return 'before-start';
  if (lapseDays.has(day)) return 'lapse';
  return day === today ? 'today' : 'clean';
}

export function cleanDayCount(week: readonly WeekDay[]): number {
  return week.filter((entry) => entry.status === 'clean').length;
}
