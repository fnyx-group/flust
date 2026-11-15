import * as fc from 'fast-check';

import { MINUTES_PER_DAY } from '@/domain/reminders';
import {
  clampIndex,
  hourRows,
  indexesOf,
  minuteOf,
  minuteRows,
  WHEEL_MINUTE_STEP,
} from '@/domain/time-wheel';

describe('wheel rows', () => {
  it('lists 00 to 23, or 12 then 1 to 11, and minutes in five minute steps', () => {
    expect(hourRows(false)).toEqual([...Array(24).keys()]);
    expect(hourRows(true)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(minuteRows()).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });
});

describe('indexesOf and minuteOf', () => {
  const at = (hour: number, minute: number) => hour * 60 + minute;

  it('selects the rows of a time on a 24 hour clock', () => {
    expect(indexesOf(at(21, 35), false)).toEqual({ hour: 21, minute: 7, period: 1 });
    expect(minuteOf({ hour: 8, minute: 0, period: 0 }, false)).toBe(at(8, 0));
  });

  it('selects the hour, the minute and the period on a 12 hour clock', () => {
    expect(indexesOf(at(0, 10), true)).toEqual({ hour: 0, minute: 2, period: 0 });
    expect(indexesOf(at(12, 0), true)).toEqual({ hour: 0, minute: 0, period: 1 });
    expect(indexesOf(at(21, 0), true)).toEqual({ hour: 9, minute: 0, period: 1 });
    expect(hourRows(true)[indexesOf(at(21, 0), true).hour]).toBe(9);
    expect(minuteOf({ hour: 0, minute: 0, period: 0 }, true)).toBe(at(0, 0));
    expect(minuteOf({ hour: 0, minute: 0, period: 1 }, true)).toBe(at(12, 0));
    expect(minuteOf({ hour: 9, minute: 6, period: 1 }, true)).toBe(at(21, 30));
  });

  it('shows the nearest time the wheels have, across the hour and midnight', () => {
    expect(minuteOf(indexesOf(at(21, 7), false), false)).toBe(at(21, 5));
    expect(minuteOf(indexesOf(at(21, 58), false), false)).toBe(at(22, 0));
    expect(minuteOf(indexesOf(at(23, 58), true), true)).toBe(at(0, 0));
  });

  it('give back every time the wheels can show, on both clocks', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MINUTES_PER_DAY / WHEEL_MINUTE_STEP - 1 }),
        fc.boolean(),
        (step, hour12) => {
          const minute = step * WHEEL_MINUTE_STEP;
          expect(minuteOf(indexesOf(minute, hour12), hour12)).toBe(minute);
        },
      ),
    );
  });

  it('always lands within five minutes, as a minute of the day', () => {
    fc.assert(
      fc.property(fc.nat({ max: MINUTES_PER_DAY - 1 }), fc.boolean(), (minute, hour12) => {
        const shown = minuteOf(indexesOf(minute, hour12), hour12);
        const gap = Math.min(Math.abs(shown - minute), MINUTES_PER_DAY - Math.abs(shown - minute));
        expect(gap).toBeLessThanOrEqual(WHEEL_MINUTE_STEP / 2);
        expect(shown).toBeGreaterThanOrEqual(0);
        expect(shown).toBeLessThan(MINUTES_PER_DAY);
      }),
    );
  });
});

describe('clampIndex', () => {
  it('keeps a row inside the wheel', () => {
    expect(clampIndex(-1, 12)).toBe(0);
    expect(clampIndex(5, 12)).toBe(5);
    expect(clampIndex(12, 12)).toBe(11);
  });
});
