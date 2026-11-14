import type { UtcOffsetAt } from '@/domain/local-time';

// Real time zone rules from Node's ICU data, so tests check actual DST transitions rather than
// hand-written ones.
export function zoneOffsetAt(timeZone: string): UtcOffsetAt {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  return (utc) => {
    const parts = new Map(format.formatToParts(utc).map((part) => [part.type, Number(part.value)]));
    const field = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? 0;
    const wall = Date.UTC(
      field('year'),
      field('month') - 1,
      field('day'),
      field('hour'),
      field('minute'),
      field('second'),
    );
    return Math.round((wall - Math.floor(utc / 1000) * 1000) / 60_000);
  };
}

export function fixedOffset(minutes: number): UtcOffsetAt {
  return () => minutes;
}
