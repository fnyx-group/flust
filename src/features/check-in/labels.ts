import type { TFunction } from 'i18next';

import { MOODS, type Mood } from '@/domain/check-in';
import { MS_PER_DAY } from '@/domain/time';
import type { ScaleOption } from '@/ui/scale-picker';

// "Jeudi 13 novembre". Local day numbers count days from 1970-01-01, so formatting the day's
// start in UTC gives its date without the device time zone shifting it a second time.
export function checkInDate(language: string, day: number): string {
  const text = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(day * MS_PER_DAY);
  return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
}

// The end labels are said with the first and last values, since they are hidden on their own.
export function moodOptions(t: TFunction): ScaleOption<Mood>[] {
  const ends: Partial<Record<Mood, string>> = {
    1: t('checkIn.moodLow'),
    5: t('checkIn.moodHigh'),
  };
  return MOODS.map((value) => {
    const label = ends[value];
    return {
      value,
      spokenLabel:
        label === undefined
          ? t('checkIn.moodValue', { value })
          : t('checkIn.moodValueWithLabel', { value, label }),
    };
  });
}
