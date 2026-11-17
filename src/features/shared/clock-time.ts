// A time of day. French on a 24 hour clock follows French typography, "21 h" and "21 h 14", with
// no-break spaces so it never splits across lines. Other languages, and 12 hour clocks, use the
// platform's format. The fields are formatted as UTC so the device time zone cannot shift them.
export function formatClockTime(
  language: string,
  hour: number,
  minute: number,
  hour12: boolean,
): string {
  if (!hour12 && language.startsWith('fr')) {
    return minute === 0 ? `${hour} h` : `${hour} h ${String(minute).padStart(2, '0')}`;
  }
  return new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12,
    timeZone: 'UTC',
  }).format(Date.UTC(2000, 0, 1, hour, minute));
}
