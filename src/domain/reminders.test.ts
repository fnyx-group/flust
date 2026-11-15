import * as fc from 'fast-check';

import { localDayNumber, utcToLocal, weekdayOf } from '@/domain/local-time';
import { RISK_MOMENT_IDS } from '@/domain/presets';
import {
  anyReminderOn,
  DEFAULT_REMINDER_SETTINGS,
  hasTimedRiskMoment,
  hourAndMinute,
  isMinuteOfDay,
  isReminderKind,
  MINUTES_PER_DAY,
  planReminders,
  REMINDER_KINDS,
  REMINDER_MINUTE_STEP,
  RETURN_GAP_DAYS,
  setCheckInReminder,
  stepMinute,
  type PlannedReminder,
  type ReminderPlanInput,
  type ReminderSettings,
} from '@/domain/reminders';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/time';
import { journeyOf } from '@test/arbitraries';
import { zoneOffsetAt } from '@test/zones';

const paris = zoneOffsetAt('Europe/Paris');
// Monday 2 March 2026, 10:00 in Paris.
const NOW = Date.UTC(2026, 2, 2, 9);
const TODAY = localDayNumber(NOW, paris);

function input(overrides: Partial<ReminderPlanInput> = {}): ReminderPlanInput {
  return {
    settings: DEFAULT_REMINDER_SETTINGS,
    riskMoments: [],
    checkInDays: [],
    journey: null,
    unlockedRanks: [],
    latestLapse: null,
    ...overrides,
  };
}

function only(settings: Partial<ReminderSettings>): ReminderSettings {
  return { ...DEFAULT_REMINDER_SETTINGS, checkInSince: TODAY, ...settings };
}

function daysOf(reminders: readonly PlannedReminder[], kind: string, offsetAt = paris): number[] {
  return reminders
    .filter((reminder) => reminder.kind === kind)
    .map((reminder) => localDayNumber(reminder.at, offsetAt) - TODAY);
}

const ZONES = ['Europe/Paris', 'America/New_York', 'Australia/Lord_Howe', 'Asia/Kolkata', 'UTC'];

const settingsArb: fc.Arbitrary<ReminderSettings> = fc.record({
  checkIn: fc.record({ on: fc.boolean(), minute: fc.nat({ max: MINUTES_PER_DAY - 1 }) }),
  thought: fc.record({ on: fc.boolean(), minute: fc.nat({ max: MINUTES_PER_DAY - 1 }) }),
  riskHours: fc.boolean(),
  ranks: fc.boolean(),
  checkInSince: fc.option(fc.integer({ min: -10, max: 0 }), { nil: null }),
});

// A year of "now" values, so plans cross every clock change of each zone.
const planArb = fc.record({
  zone: fc.constantFrom(...ZONES),
  now: fc.integer({ min: Date.UTC(2026, 0, 1), max: Date.UTC(2027, 0, 1) }),
  settings: settingsArb,
  riskMoments: fc.subarray([...RISK_MOMENT_IDS]),
  checkInBack: fc.subarray([0, 1, 2, 3, 4, 5, 6, 8, 10]),
  streakDays: fc.integer({ min: 0, max: 400 }),
  lapseHoursAgo: fc.option(fc.integer({ min: 0, max: 30 }), { nil: null }),
});

type PlanCase = typeof planArb extends fc.Arbitrary<infer T> ? T : never;

function planFrom(arb: PlanCase) {
  const offsetAt = zoneOffsetAt(arb.zone);
  const today = localDayNumber(arb.now, offsetAt);
  const settings = {
    ...arb.settings,
    checkInSince: arb.settings.checkInSince === null ? null : today + arb.settings.checkInSince,
  };
  const lapseAt = arb.lapseHoursAgo === null ? null : arb.now - arb.lapseHoursAgo * MS_PER_HOUR;
  const start = arb.now - arb.streakDays * MS_PER_DAY - MS_PER_HOUR;
  const journey = journeyOf(start, lapseAt === null || lapseAt < start ? [] : [lapseAt]);
  const plan = planReminders(
    {
      settings,
      riskMoments: arb.riskMoments,
      checkInDays: arb.checkInBack.map((back) => today - back),
      journey,
      unlockedRanks: [],
      latestLapse: lapseAt === null ? null : { id: 1, at: lapseAt, recordedAt: lapseAt },
    },
    arb.now,
    offsetAt,
  );
  return { plan, offsetAt, today, settings };
}

describe('planReminders', () => {
  it('plans nothing while every reminder is off', () => {
    expect(planReminders(input(), NOW, paris)).toEqual([]);
  });

  it('spaces check-ins over a week, then ends with the return message', () => {
    const plan = planReminders(
      input({ settings: only({ checkIn: { on: true, minute: 21 * 60 } }) }),
      NOW,
      paris,
    );
    expect(daysOf(plan, 'check-in')).toEqual([0, 1, 2, 4, 6]);
    const last = plan.at(-1);
    expect(last?.kind).toBe('return');
    expect(last?.local).toMatchObject({ day: 9, month: 3, hour: 21, minute: 0 });
  });

  it('counts check-ins from the last one, and skips days that have one', () => {
    const settings = only({ checkIn: { on: true, minute: 21 * 60 }, checkInSince: TODAY - 30 });
    const plan = planReminders(input({ settings, checkInDays: [TODAY, TODAY - 3] }), NOW, paris);
    expect(daysOf(plan, 'check-in')).toEqual([1, 2, 3, 5]);
  });

  it('sends the return message at 19:00 without the check-in reminder', () => {
    const plan = planReminders(input({ settings: only({ ranks: true }) }), NOW, paris);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'return', floating: true });
    expect(plan[0]?.local).toMatchObject({ hour: 19, minute: 0 });
    expect(localDayNumber(plan[0]?.at ?? 0, paris)).toBe(TODAY + RETURN_GAP_DAYS);
  });

  it('spaces the thought on the days after the app was opened', () => {
    const plan = planReminders(
      input({ settings: only({ thought: { on: true, minute: 8 * 60 } }) }),
      NOW,
      paris,
    );
    // Today at 08:00 has passed.
    expect(daysOf(plan, 'thought')).toEqual([1, 2, 4]);
  });

  it('reminds before the night and on the next Saturday for timed risk moments only', () => {
    const settings = only({ riskHours: true });
    const plan = planReminders(
      input({ settings, riskMoments: ['in-bed-at-night', 'weekend', 'stress'] }),
      NOW,
      paris,
    );
    const risk = plan.filter((reminder) => reminder.kind === 'risk-hours');
    expect(
      risk.map((reminder) => [localDayNumber(reminder.at, paris) - TODAY, reminder.local.hour]),
    ).toEqual([
      [0, 22],
      [1, 22],
      [2, 22],
      [4, 22],
      [5, 10],
    ]);
    expect(weekdayOf(TODAY + 5)).toBe(7);
  });

  it('has no risk reminders without a timed risk moment', () => {
    const plan = planReminders(
      input({ settings: only({ riskHours: true }), riskMoments: ['stress'] }),
      NOW,
      paris,
    );
    expect(plan.map((reminder) => reminder.kind)).toEqual(['return']);
  });

  it('keeps the check-in when a day has too many, two hours apart at least', () => {
    const settings = only({
      checkIn: { on: true, minute: 21 * 60 },
      thought: { on: true, minute: 21 * 60 + 30 },
      riskHours: true,
    });
    const plan = planReminders(input({ settings, riskMoments: ['in-bed-at-night'] }), NOW, paris);
    const today = plan.filter((reminder) => localDayNumber(reminder.at, paris) === TODAY);
    expect(today.map((reminder) => reminder.kind)).toEqual(['check-in']);
  });

  it('times the rank reminder for when it is reached, in the daytime', () => {
    // Started at 23:00, so the first rank is reached at night and waits for 09:00.
    const start = Date.UTC(2026, 2, 1, 22);
    const plan = planReminders(
      input({ settings: only({ ranks: true }), journey: journeyOf(start) }),
      NOW,
      paris,
    );
    const rank = plan.find((reminder) => reminder.kind === 'rank');
    expect(rank).toMatchObject({ floating: false });
    expect(rank?.local).toMatchObject({ day: 3, hour: 9, minute: 0 });
  });

  it('holds the rank reminder for six hours after a lapse is logged', () => {
    // The first rank is reached in four hours, before the six that follow the lapse.
    const start = NOW - 20 * MS_PER_HOUR;
    const loggedAt = NOW - MS_PER_HOUR;
    const plan = planReminders(
      input({
        settings: only({ ranks: true }),
        journey: journeyOf(start),
        latestLapse: { id: 1, at: start - MS_PER_DAY, recordedAt: loggedAt },
      }),
      NOW,
      paris,
    );
    const rank = plan.find((reminder) => reminder.kind === 'rank');
    expect(rank?.at).toBe(loggedAt + 6 * MS_PER_HOUR);
  });

  it('keeps the wall time across a clock change', () => {
    // The week of the spring change in Paris, 29 March 2026.
    const now = Date.UTC(2026, 2, 26, 9);
    const plan = planReminders(
      input({
        settings: only({
          checkIn: { on: true, minute: 21 * 60 },
          checkInSince: localDayNumber(now, paris),
        }),
      }),
      now,
      paris,
    );
    for (const reminder of plan)
      expect(utcToLocal(reminder.at, paris)).toMatchObject({ hour: 21, minute: 0 });
  });

  describe('for any settings, zone and history', () => {
    it('plans only the future, in order, and ends with the return message', () => {
      fc.assert(
        fc.property(planArb, (arb) => {
          const { plan, offsetAt, today } = planFrom(arb);
          if (!anyReminderOn(arb.settings)) return expect(plan).toEqual([]);
          expect(plan.at(-1)?.kind).toBe('return');
          expect(plan.filter((reminder) => reminder.kind === 'return')).toHaveLength(1);
          expect(localDayNumber(plan.at(-1)?.at ?? 0, offsetAt)).toBe(today + RETURN_GAP_DAYS);
          plan.forEach((reminder, index) => {
            expect(reminder.at).toBeGreaterThan(arb.now);
            if (index > 0) expect(reminder.at).toBeGreaterThanOrEqual(plan[index - 1]?.at ?? 0);
            expect(reminder.local).toEqual(utcToLocal(reminder.at, offsetAt));
            expect(reminder.floating).toBe(reminder.kind !== 'rank');
          });
        }),
      );
    });

    it('caps routine reminders per day', () => {
      fc.assert(
        fc.property(planArb, (arb) => {
          const { plan, offsetAt, today } = planFrom(arb);
          const routine = plan.filter(
            (r) => r.kind === 'check-in' || r.kind === 'thought' || r.kind === 'risk-hours',
          );
          const byDay = new Map<number, PlannedReminder[]>();
          for (const reminder of routine) {
            const day = localDayNumber(reminder.at, offsetAt);
            byDay.set(day, [...(byDay.get(day) ?? []), reminder]);
          }
          for (const [day, reminders] of byDay) {
            expect(reminders.length).toBeLessThanOrEqual(day - today >= 3 ? 1 : 2);
            if (reminders.length === 2) {
              const [a, b] = reminders;
              expect(Math.abs((a?.at ?? 0) - (b?.at ?? 0))).toBeGreaterThanOrEqual(2 * MS_PER_HOUR);
            }
          }
        }),
      );
    });

    it('never reminds of a check-in on a day that has one', () => {
      fc.assert(
        fc.property(planArb, (arb) => {
          const { plan, offsetAt, today } = planFrom(arb);
          const checkInDays = arb.checkInBack.map((back) => today - back);
          for (const reminder of plan.filter((r) => r.kind === 'check-in')) {
            expect(checkInDays).not.toContain(localDayNumber(reminder.at, offsetAt));
          }
        }),
      );
    });

    it('sends a rank reminder in the daytime, outside the hours after a lapse', () => {
      fc.assert(
        fc.property(planArb, (arb) => {
          const { plan } = planFrom(arb);
          const rank = plan.find((reminder) => reminder.kind === 'rank');
          if (rank === undefined) return;
          const minute = rank.local.hour * 60 + rank.local.minute;
          expect(minute).toBeGreaterThanOrEqual(9 * 60);
          expect(minute).toBeLessThan(22 * 60);
          if (arb.lapseHoursAgo !== null) {
            expect(rank.at).toBeGreaterThanOrEqual(
              arb.now - arb.lapseHoursAgo * MS_PER_HOUR + 6 * MS_PER_HOUR,
            );
          }
        }),
      );
    });

    it('keeps each chosen time on the wall clock, unless a clock change skipped it', () => {
      fc.assert(
        fc.property(planArb, (arb) => {
          const { plan, settings } = planFrom(arb);
          for (const reminder of plan.filter(
            (r) => r.kind === 'check-in' || r.kind === 'thought',
          )) {
            const chosen =
              reminder.kind === 'check-in' ? settings.checkIn.minute : settings.thought.minute;
            const wall = reminder.local.hour * 60 + reminder.local.minute;
            // A skipped time moves forward by the size of the gap, at most an hour.
            expect(wall - chosen).toBeGreaterThanOrEqual(0);
            expect(wall - chosen).toBeLessThanOrEqual(60);
          }
        }),
      );
    });
  });
});

describe('setCheckInReminder', () => {
  it('remembers the day it was turned on, and only then', () => {
    const on = setCheckInReminder(DEFAULT_REMINDER_SETTINGS, true, 100);
    expect(on.checkIn.on).toBe(true);
    expect(on.checkInSince).toBe(100);
    expect(setCheckInReminder(on, true, 105).checkInSince).toBe(100);
    const off = setCheckInReminder(on, false, 106);
    expect(off).toMatchObject({ checkIn: { on: false }, checkInSince: 100 });
    expect(setCheckInReminder(off, true, 110).checkInSince).toBe(110);
  });
});

describe('reminder settings', () => {
  it('starts with everything off, at 21:00 and 08:00', () => {
    expect(anyReminderOn(DEFAULT_REMINDER_SETTINGS)).toBe(false);
    expect(hourAndMinute(DEFAULT_REMINDER_SETTINGS.checkIn.minute)).toEqual({
      hour: 21,
      minute: 0,
    });
    expect(hourAndMinute(DEFAULT_REMINDER_SETTINGS.thought.minute)).toEqual({ hour: 8, minute: 0 });
  });

  it('knows its kinds and minutes', () => {
    for (const kind of REMINDER_KINDS) expect(isReminderKind(kind)).toBe(true);
    expect(isReminderKind('after-lapse')).toBe(false);
    expect(isMinuteOfDay(0)).toBe(true);
    expect(isMinuteOfDay(MINUTES_PER_DAY - 1)).toBe(true);
    expect(isMinuteOfDay(MINUTES_PER_DAY)).toBe(false);
    expect(isMinuteOfDay(1.5)).toBe(false);
    expect(isMinuteOfDay('60')).toBe(false);
  });

  it('knows which risk moments have a time', () => {
    expect(hasTimedRiskMoment(['stress', 'boredom'])).toBe(false);
    expect(hasTimedRiskMoment(['stress', 'weekend'])).toBe(true);
    expect(hasTimedRiskMoment(['in-bed-at-night'])).toBe(true);
  });
});

describe('stepMinute', () => {
  it('moves by five minutes and wraps around midnight', () => {
    expect(REMINDER_MINUTE_STEP).toBe(5);
    expect(stepMinute(0, -1)).toBe(MINUTES_PER_DAY - 5);
    expect(stepMinute(23 * 60 + 55, 1)).toBe(0);
    expect(stepMinute(21 * 60, -12)).toBe(20 * 60);
  });

  it('always lands on a minute of the day', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: MINUTES_PER_DAY - 1 }),
        fc.integer({ min: -1000, max: 1000 }),
        (minute, steps) => {
          expect(isMinuteOfDay(stepMinute(minute, steps))).toBe(true);
        },
      ),
    );
  });
});
