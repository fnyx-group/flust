import {
  clampStart,
  defaultPastStart,
  isDaySelectable,
  selectDay,
  startBounds,
  stepHour,
  stepMinute,
} from '@/domain/start-point';
import { utcToLocal } from '@/domain/local-time';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { fixedOffset, zoneOffsetAt } from '@test/zones';

const NOW = Date.UTC(2026, 10, 14, 15, 37, 42);
const bounds = startBounds(NOW);
const utc = fixedOffset(0);
const paris = zoneOffsetAt('Europe/Paris');

describe('startBounds', () => {
  it('ends at the start of the current minute and reaches about ten years back', () => {
    expect(bounds.max).toBe(Date.UTC(2026, 10, 14, 15, 37));
    expect(bounds.max - bounds.min).toBe(3653 * MS_PER_DAY);
  });
});

describe('clampStart', () => {
  it('never goes past now or before the earliest start, and drops seconds', () => {
    expect(clampStart(NOW + MS_PER_HOUR, bounds)).toBe(bounds.max);
    expect(clampStart(bounds.min - 1, bounds)).toBe(bounds.min);
    expect(clampStart(Date.UTC(2026, 0, 1, 10, 5, 59), bounds)).toBe(Date.UTC(2026, 0, 1, 10, 5));
  });
});

describe('defaultPastStart', () => {
  it('is one day ago', () => {
    expect(defaultPastStart(bounds)).toBe(bounds.max - MS_PER_DAY);
  });
});

describe('selectDay', () => {
  const selected = Date.UTC(2026, 10, 10, 8, 20);

  it('keeps the time of day', () => {
    expect(selectDay(selected, { year: 2026, month: 9, day: 3 }, utc, bounds)).toBe(
      Date.UTC(2026, 8, 3, 8, 20),
    );
  });

  it('clamps today to now', () => {
    const evening = Date.UTC(2026, 10, 10, 22, 0);
    expect(selectDay(evening, { year: 2026, month: 11, day: 14 }, utc, bounds)).toBe(bounds.max);
  });

  it('moves a time skipped by a clock change forward', () => {
    const halfPastTwo = Date.UTC(2026, 10, 10, 1, 30);
    expect(selectDay(halfPastTwo, { year: 2026, month: 3, day: 29 }, paris, bounds)).toBe(
      Date.UTC(2026, 2, 29, 1, 30),
    );
  });

  it('uses the last day of a shorter month', () => {
    expect(selectDay(selected, { year: 2026, month: 2, day: 31 }, utc, bounds)).toBe(
      Date.UTC(2026, 1, 28, 8, 20),
    );
  });

  it('keeps the selection when the date cannot exist', () => {
    expect(selectDay(selected, { year: 1960, month: 1, day: 1 }, utc, bounds)).toBe(selected);
  });
});

describe('stepHour and stepMinute', () => {
  const selected = Date.UTC(2026, 10, 10, 8, 20);

  it('move along real time', () => {
    expect(stepHour(selected, 1, bounds)).toBe(selected + MS_PER_HOUR);
    expect(stepHour(selected, -1, bounds)).toBe(selected - MS_PER_HOUR);
    expect(stepMinute(selected, 1, bounds)).toBe(selected + 5 * MS_PER_MINUTE);
    expect(stepMinute(selected, -1, bounds)).toBe(selected - 5 * MS_PER_MINUTE);
  });

  it('land the first minute step on a multiple of five, in both directions', () => {
    const odd = Date.UTC(2026, 10, 10, 8, 37);
    expect(stepMinute(odd, 1, bounds)).toBe(Date.UTC(2026, 10, 10, 8, 40));
    expect(stepMinute(odd, -1, bounds)).toBe(Date.UTC(2026, 10, 10, 8, 35));
  });

  it('align the wall clock in a zone with a 45 minute offset', () => {
    const kathmandu = zoneOffsetAt('Asia/Kathmandu');
    const odd = Date.UTC(2026, 10, 10, 8, 37);
    expect(utcToLocal(stepMinute(odd, 1, bounds), kathmandu).minute % 5).toBe(0);
  });

  it('stop at now', () => {
    expect(stepHour(bounds.max - MS_PER_MINUTE, 1, bounds)).toBe(bounds.max);
    expect(stepMinute(bounds.max, 1, bounds)).toBe(bounds.max);
  });

  it('step back through an hour skipped by a clock change', () => {
    // 03:30 in Paris on 29 March 2026; one hour earlier is 01:30, since 02:30 does not exist.
    const afterGap = Date.UTC(2026, 2, 29, 1, 30);
    expect(utcToLocal(afterGap, paris)).toEqual({
      year: 2026,
      month: 3,
      day: 29,
      hour: 3,
      minute: 30,
    });
    const before = stepHour(afterGap, -1, bounds);
    expect(utcToLocal(before, paris)).toEqual({
      year: 2026,
      month: 3,
      day: 29,
      hour: 1,
      minute: 30,
    });
    expect(utcToLocal(stepHour(before, 1, bounds), paris).hour).toBe(3);
  });
});

describe('isDaySelectable', () => {
  it('allows today and past days, refuses future days', () => {
    expect(isDaySelectable({ year: 2026, month: 11, day: 14 }, utc, bounds)).toBe(true);
    expect(isDaySelectable({ year: 2026, month: 11, day: 13 }, utc, bounds)).toBe(true);
    expect(isDaySelectable({ year: 2026, month: 11, day: 15 }, utc, bounds)).toBe(false);
  });

  it('refuses days before the earliest start', () => {
    expect(isDaySelectable({ year: 2016, month: 1, day: 1 }, utc, bounds)).toBe(false);
  });

  it('follows the time zone: tomorrow in Kiritimati is already today there', () => {
    expect(isDaySelectable({ year: 2026, month: 11, day: 15 }, fixedOffset(840), bounds)).toBe(
      true,
    );
  });

  it('allows a day whose midnight is skipped by a clock change', () => {
    // Santiago skips from 24:00 to 01:00 on the night of 5 to 6 September 2026.
    const santiago = zoneOffsetAt('America/Santiago');
    expect(isDaySelectable({ year: 2026, month: 9, day: 6 }, santiago, bounds)).toBe(true);
  });

  it('refuses a date that does not exist', () => {
    expect(isDaySelectable({ year: 2026, month: 2, day: 30 }, utc, bounds)).toBe(false);
  });
});
