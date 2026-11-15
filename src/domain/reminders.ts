import { isOneOf } from '@/domain/guards';
import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import {
  dateOfDay,
  localDayNumber,
  localToUtc,
  utcToLocal,
  weekdayOf,
  type LocalDateTime,
  type UtcOffsetAt,
  type Weekday,
} from '@/domain/local-time';
import type { RiskMomentId } from '@/domain/presets';
import { nextRankAt, type RankId } from '@/domain/ranks';
import { MS_PER_HOUR, type Timestamp } from '@/domain/time';

export const REMINDER_KINDS = ['check-in', 'thought', 'risk-hours', 'rank', 'return'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
export const isReminderKind = isOneOf(REMINDER_KINDS);

// Minutes since local midnight.
export type MinuteOfDay = number;

export const MINUTES_PER_DAY = 24 * 60;

export type ReminderSettings = {
  readonly checkIn: { readonly on: boolean; readonly minute: MinuteOfDay };
  readonly thought: { readonly on: boolean; readonly minute: MinuteOfDay };
  readonly riskHours: boolean;
  readonly ranks: boolean;
  // The local day the check-in reminder was last turned on. Before any check-in, spacing counts
  // from the day before it, so the first evening is reminded.
  readonly checkInSince: number | null;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  checkIn: { on: false, minute: 21 * 60 },
  thought: { on: false, minute: 8 * 60 },
  riskHours: false,
  ranks: false,
  checkInSince: null,
};

export function isMinuteOfDay(value: unknown): value is MinuteOfDay {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < MINUTES_PER_DAY;
}

export function anyReminderOn(settings: ReminderSettings): boolean {
  return settings.checkIn.on || settings.thought.on || settings.riskHours || settings.ranks;
}

// Every reminder off, kept that way until each is turned on again, such as when notifications
// are no longer allowed. The check-in counts from the day it is turned on again.
export function allRemindersOff(settings: ReminderSettings): ReminderSettings {
  return {
    checkIn: { ...settings.checkIn, on: false },
    thought: { ...settings.thought, on: false },
    riskHours: false,
    ranks: false,
    checkInSince: null,
  };
}

export function setCheckInReminder(
  settings: ReminderSettings,
  on: boolean,
  today: number,
): ReminderSettings {
  return {
    ...settings,
    checkIn: { ...settings.checkIn, on },
    checkInSince: on && !settings.checkIn.on ? today : settings.checkInSince,
  };
}

// Risk moments with a time of their own. The others, such as stress, have no hour to remind
// before. A weekday of null means every day.
type TimedMoment = { readonly weekday: Weekday | null; readonly minute: MinuteOfDay };

const SATURDAY: Weekday = 7;

const TIMED_RISK_MOMENTS: Partial<Record<RiskMomentId, TimedMoment>> = {
  'in-bed-at-night': { weekday: null, minute: 22 * 60 + 30 },
  weekend: { weekday: SATURDAY, minute: 10 * 60 },
};

export function hasTimedRiskMoment(moments: readonly RiskMomentId[]): boolean {
  return moments.some((moment) => TIMED_RISK_MOMENTS[moment] !== undefined);
}

export type PlannedReminder = {
  readonly kind: ReminderKind;
  readonly at: Timestamp;
  readonly local: LocalDateTime;
  // A floating reminder keeps its wall time when the time zone changes; a fixed one keeps its
  // instant, like the moment a rank is reached.
  readonly floating: boolean;
};

export type ReminderPlanInput = {
  readonly settings: ReminderSettings;
  readonly riskMoments: readonly RiskMomentId[];
  // Local days that have a check-in. Only the latest matters, so a recent window is enough.
  readonly checkInDays: readonly number[];
  readonly journey: Journey | null;
  readonly unlockedRanks: readonly RankId[];
  readonly latestLapse: LapseRecord | null;
};

// Gaps in local days. Check-ins count from the last check-in; the others from today, the day
// the plan is made, which is a day the app was opened.
const CHECK_IN_GAPS = [1, 2, 3, 5, 7];
const LAST_CHECK_IN_GAP = 7;
const OPENED_GAPS = [0, 1, 2, 4];
export const RETURN_GAP_DAYS = 7;
// From this many days after the app was last opened, one routine reminder a day at most.
const QUIET_FROM_GAP = 3;
const MAX_ROUTINE_PER_DAY = 2;
const MIN_ROUTINE_SPACING_MS = 2 * MS_PER_HOUR;

const RETURN_MINUTE: MinuteOfDay = 19 * 60;
const RANK_EARLIEST: MinuteOfDay = 9 * 60;
const RANK_LATEST: MinuteOfDay = 22 * 60;
const HOURS_AFTER_LAPSE_MS = 6 * MS_PER_HOUR;

// Routine reminders in priority order, when a day has room for fewer than were planned. Risk
// reminders are not capped: the person turned them on for that exact moment.
const ROUTINE_PRIORITY: readonly ReminderKind[] = ['check-in', 'thought'];

// Every reminder until the return message, planned at once. Nothing runs in the background, so
// the list already holds the spacing: if the app is never opened again it runs out, ends with
// the return message, and flust stays silent. Opening the app plans again from that day.
export function planReminders(
  input: ReminderPlanInput,
  now: Timestamp,
  offsetAt: UtcOffsetAt,
): PlannedReminder[] {
  const { settings } = input;
  if (!anyReminderOn(settings)) return [];
  const today = localDayNumber(now, offsetAt);
  const returnDay = today + RETURN_GAP_DAYS;
  const returnMinute = settings.checkIn.on ? settings.checkIn.minute : RETURN_MINUTE;
  const back = at(returnDay, returnMinute, 'return', true, offsetAt);
  if (back === null) return [];
  const beforeReturn = (reminder: PlannedReminder) => reminder.at > now && reminder.at < back.at;
  const routine = capRoutine(
    [
      ...checkInReminders(input, today, offsetAt),
      ...thoughtReminders(settings, today, offsetAt),
    ].filter(beforeReturn),
    today,
    offsetAt,
  );
  const risk = riskReminders(input, today, offsetAt).filter(beforeReturn);
  const rank = rankReminder(input, now, offsetAt);
  const extra = rank !== null && rank.at < back.at ? [rank] : [];
  return [...routine, ...risk, ...extra, back].sort((a, b) => a.at - b.at);
}

function checkInReminders(
  { settings, checkInDays }: ReminderPlanInput,
  today: number,
  offsetAt: UtcOffsetAt,
): PlannedReminder[] {
  if (!settings.checkIn.on) return [];
  const since = (settings.checkInSince ?? today) - 1;
  const latest = Math.max(since, ...checkInDays.filter((day) => day <= today));
  // Once the spacing from the last check-in has run out, an open starts it again from today, so
  // someone who opens the app without checking in still gets the evening reminder.
  const anchor = latest + LAST_CHECK_IN_GAP < today ? today - 1 : latest;
  return CHECK_IN_GAPS.map((gap) => anchor + gap)
    .filter((day) => day >= today && !checkInDays.includes(day))
    .flatMap((day) => present(at(day, settings.checkIn.minute, 'check-in', true, offsetAt)));
}

function thoughtReminders(
  settings: ReminderSettings,
  today: number,
  offsetAt: UtcOffsetAt,
): PlannedReminder[] {
  if (!settings.thought.on) return [];
  return OPENED_GAPS.flatMap((gap) =>
    present(at(today + gap, settings.thought.minute, 'thought', true, offsetAt)),
  );
}

// A daily moment follows the same spacing as the thought, without the daily cap or the two hours
// between routine reminders. A weekly one is already sparse: it comes once, on its next day
// before the return message.
function riskReminders(
  { settings, riskMoments }: ReminderPlanInput,
  today: number,
  offsetAt: UtcOffsetAt,
): PlannedReminder[] {
  if (!settings.riskHours) return [];
  return riskMoments.flatMap((moment) => {
    const timed = TIMED_RISK_MOMENTS[moment];
    if (timed === undefined) return [];
    const days =
      timed.weekday === null
        ? OPENED_GAPS.map((gap) => today + gap)
        : nextWeekday(today, timed.weekday);
    return days.flatMap((day) => present(at(day, timed.minute, 'risk-hours', true, offsetAt)));
  });
}

function nextWeekday(today: number, weekday: Weekday): number[] {
  for (let day = today; day < today + RETURN_GAP_DAYS; day++) {
    if (weekdayOf(day) === weekday) return [day];
  }
  return [];
}

// No rank reminder in the hours after a lapse, when home holds the unlock screen too, nor at
// night: it waits for the morning.
function rankReminder(
  { settings, journey, unlockedRanks, latestLapse }: ReminderPlanInput,
  now: Timestamp,
  offsetAt: UtcOffsetAt,
): PlannedReminder | null {
  if (!settings.ranks || journey === null) return null;
  const reached = nextRankAt(journey, unlockedRanks, now);
  if (reached === null) return null;
  const held =
    latestLapse === null || latestLapse.recordedAt === null
      ? reached
      : Math.max(reached, latestLapse.recordedAt + HOURS_AFTER_LAPSE_MS);
  const moment = awake(held, offsetAt);
  if (moment === null || moment <= now) return null;
  return { kind: 'rank', at: moment, local: utcToLocal(moment, offsetAt), floating: false };
}

function awake(moment: Timestamp, offsetAt: UtcOffsetAt): Timestamp | null {
  const local = utcToLocal(moment, offsetAt);
  const minute = local.hour * 60 + local.minute;
  if (minute >= RANK_EARLIEST && minute < RANK_LATEST) return moment;
  const day = localDayNumber(moment, offsetAt) + (minute >= RANK_LATEST ? 1 : 0);
  return at(day, RANK_EARLIEST, 'rank', false, offsetAt)?.at ?? null;
}

// Up to two routine reminders a day while the app was opened recently, two hours apart at
// least, then one a day. The check-in wins a day that has too many.
function capRoutine(
  reminders: readonly PlannedReminder[],
  today: number,
  offsetAt: UtcOffsetAt,
): PlannedReminder[] {
  const byPriority = [...reminders].sort(
    (a, b) => ROUTINE_PRIORITY.indexOf(a.kind) - ROUTINE_PRIORITY.indexOf(b.kind) || a.at - b.at,
  );
  const kept: PlannedReminder[] = [];
  for (const reminder of byPriority) {
    const day = localDayNumber(reminder.at, offsetAt);
    const sameDay = kept.filter((other) => localDayNumber(other.at, offsetAt) === day);
    const limit = day - today >= QUIET_FROM_GAP ? 1 : MAX_ROUTINE_PER_DAY;
    const tooClose = sameDay.some(
      (other) => Math.abs(other.at - reminder.at) < MIN_ROUTINE_SPACING_MS,
    );
    if (sameDay.length < limit && !tooClose) kept.push(reminder);
  }
  return kept;
}

function at(
  day: number,
  minute: MinuteOfDay,
  kind: ReminderKind,
  floating: boolean,
  offsetAt: UtcOffsetAt,
): PlannedReminder | null {
  const local = { ...dateOfDay(day), hour: Math.floor(minute / 60), minute: minute % 60 };
  const utc = localToUtc(local, offsetAt);
  if (!utc.ok) return null;
  // A wall time skipped by a clock change moves forward, so the stored wall time is the real one.
  return { kind, at: utc.value, local: utcToLocal(utc.value, offsetAt), floating };
}

function present(reminder: PlannedReminder | null): PlannedReminder[] {
  return reminder === null ? [] : [reminder];
}

export function hourAndMinute(minute: MinuteOfDay): { hour: number; minute: number } {
  return { hour: Math.floor(minute / 60), minute: minute % 60 };
}

export const REMINDER_MINUTE_STEP = 5;

// Steps the chosen time by five minutes, wrapping around midnight.
export function stepMinute(minute: MinuteOfDay, steps: number): MinuteOfDay {
  const step = REMINDER_MINUTE_STEP * steps;
  return (((minute + step) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
