import { getCalendars } from 'expo-localization';

import type { UtcOffsetAt, Weekday } from '@/domain/local-time';

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const MONDAY: Weekday = 2;

// getTimezoneOffset counts minutes west of UTC and follows the device's DST rules for any date.
export const deviceOffsetAt: UtcOffsetAt = (utc) => -new Date(utc).getTimezoneOffset();

export function deviceCalendar(): { firstWeekday: Weekday; hour12: boolean } {
  const calendar = getCalendars()[0];
  return {
    firstWeekday: WEEKDAYS.find((day) => day === calendar?.firstWeekday) ?? MONDAY,
    hour12: calendar?.uses24hourClock === false,
  };
}
