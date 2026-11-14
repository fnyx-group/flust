import type { LocalDateTime, Weekday } from '@/domain/local-time';

type LocalDate = Pick<LocalDateTime, 'year' | 'month' | 'day'>;

// Local fields are formatted as if they were UTC, so the device time zone cannot shift them a
// second time.
function format(language: string, options: Intl.DateTimeFormatOptions, utc: number): string {
  return new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(utc);
}

export function formatMonth(language: string, year: number, month: number): string {
  return format(language, { month: 'long', year: 'numeric' }, Date.UTC(year, month - 1, 1));
}

export function formatFullDate(language: string, { year, month, day }: LocalDate): string {
  return format(
    language,
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    Date.UTC(year, month - 1, day),
  );
}

export function formatDateTime(language: string, local: LocalDateTime, hour12: boolean): string {
  const { year, month, day, hour, minute } = local;
  return format(
    language,
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12,
    },
    Date.UTC(year, month - 1, day, hour, minute),
  );
}

export function formatHour(language: string, hour: number, hour12: boolean): string {
  return format(language, { hour: 'numeric', hour12 }, Date.UTC(2000, 0, 1, hour));
}

export function formatMinute(minute: number): string {
  return String(minute).padStart(2, '0');
}

// 2 January 2000 was a Sunday, the day expo-localization numbers 1.
export function formatWeekdays(language: string, firstWeekday: Weekday): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    format(language, { weekday: 'narrow' }, Date.UTC(2000, 0, 1 + firstWeekday + index)),
  );
}
