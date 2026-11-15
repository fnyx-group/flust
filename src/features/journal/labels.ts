import type { TFunction } from 'i18next';

import type { NoteGroupKey, NoteSummary } from '@/domain/journal';
import type { LocalDateTime } from '@/domain/local-time';
import { MS_PER_DAY } from '@/domain/time';

export const PROMPT_IDS = ['helped', 'proud', 'tomorrow'] as const;
export type PromptId = (typeof PROMPT_IDS)[number];

// Local fields and day numbers are formatted as if they were UTC, so the device time zone cannot
// shift them a second time.
function format(language: string, options: Intl.DateTimeFormatOptions, utc: number): string {
  return new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(utc);
}

function capitalize(language: string, text: string): string {
  return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
}

// "Mercredi 12 nov.", the day a note was written on, from its stored local day.
export function noteListDate(language: string, day: number): string {
  return capitalize(
    language,
    format(language, { weekday: 'long', day: 'numeric', month: 'short' }, day * MS_PER_DAY),
  );
}

// "Octobre", or "Octobre 2025" for a month of another year than the current one.
export function noteGroupTitle(
  t: TFunction,
  language: string,
  key: NoteGroupKey,
  currentYear: number,
): string {
  switch (key.kind) {
    case 'this-week':
      return t('journal.groups.thisWeek');
    case 'last-week':
      return t('journal.groups.lastWeek');
    case 'month': {
      const options: Intl.DateTimeFormatOptions =
        key.year === currentYear ? { month: 'long' } : { month: 'long', year: 'numeric' };
      return capitalize(language, format(language, options, Date.UTC(key.year, key.month - 1, 1)));
    }
  }
}

// "Jeudi 13 novembre, 22:14", with the year when it is not the current one. The time follows the
// device's 12 or 24 hour setting, like the time pickers.
export function noteDateTime(
  t: TFunction,
  language: string,
  local: LocalDateTime,
  currentYear: number,
  hour12: boolean,
): string {
  const { year, month, day, hour, minute } = local;
  const at = Date.UTC(year, month - 1, day, hour, minute);
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  };
  if (year !== currentYear) dateOptions.year = 'numeric';
  const date = capitalize(language, format(language, dateOptions, at));
  const time = format(language, { hour: 'numeric', minute: '2-digit', hour12 }, at);
  return t('journal.note.dateTime', { date, time });
}

// Screen readers read a row as one button: its date, its title if any, then the start of the text.
export function noteRowLabel(language: string, note: NoteSummary): string {
  return [noteListDate(language, note.day), note.title, note.excerpt]
    .filter((part) => part !== null)
    .join(', ');
}
