import { MINUTES_PER_DAY, type MinuteOfDay } from '@/domain/reminders';

// The rows of a time picker made of wheels: hours, minutes in five minute steps, and the period
// on a 12 hour clock. Indexes are the selected row of each wheel.
export const WHEEL_MINUTE_STEP = 5;

export type WheelIndexes = {
  readonly hour: number;
  readonly minute: number;
  readonly period: number;
};

const HOURS_24 = Array.from({ length: 24 }, (_, hour) => hour);
// 12, then 1 to 11, as clocks show them; 12 AM is midnight.
const HOURS_12 = [12, ...Array.from({ length: 11 }, (_, index) => index + 1)];
const MINUTES = Array.from(
  { length: 60 / WHEEL_MINUTE_STEP },
  (_, index) => index * WHEEL_MINUTE_STEP,
);

export function hourRows(hour12: boolean): readonly number[] {
  return hour12 ? HOURS_12 : HOURS_24;
}

export function minuteRows(): readonly number[] {
  return MINUTES;
}

// The nearest time the wheels can show, so 21:58 shows as 22:00 and 23:58 as 00:00.
export function indexesOf(minute: MinuteOfDay, hour12: boolean): WheelIndexes {
  const rounded = (Math.round(minute / WHEEL_MINUTE_STEP) * WHEEL_MINUTE_STEP) % MINUTES_PER_DAY;
  const hour = Math.floor(rounded / 60);
  return {
    hour: hour12 ? hour % 12 : hour,
    minute: (rounded % 60) / WHEEL_MINUTE_STEP,
    period: hour < 12 ? 0 : 1,
  };
}

export function minuteOf(indexes: WheelIndexes, hour12: boolean): MinuteOfDay {
  const hour = hour12 ? (indexes.hour % 12) + (indexes.period === 1 ? 12 : 0) : indexes.hour;
  return hour * 60 + indexes.minute * WHEEL_MINUTE_STEP;
}

// Keeps a row inside the wheel, for the increment and decrement of assistive technologies.
export function clampIndex(index: number, rowCount: number): number {
  return Math.min(Math.max(index, 0), rowCount - 1);
}
