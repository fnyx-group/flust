import type { TFunction } from 'i18next';

import type { HoursAndMinutes, StreakDisplay } from '@/domain/streak';

// "12 days", "7 hours 40 minutes", "1 hour".
export function spokenStreak(t: TFunction, display: StreakDisplay): string {
  return display.unit === 'days'
    ? t('units.day', { count: display.days })
    : spokenHoursMinutes(t, display);
}

export function spokenHoursMinutes(t: TFunction, { hours, minutes }: HoursAndMinutes): string {
  const spokenMinutes = t('units.minute', { count: minutes });
  if (hours === 0) return spokenMinutes;
  const spokenHours = t('units.hour', { count: hours });
  if (minutes === 0) return spokenHours;
  return t('home.streak.spokenHoursMinutes', { hours: spokenHours, minutes: spokenMinutes });
}
