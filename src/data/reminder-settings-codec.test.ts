import * as fc from 'fast-check';

import { decodeReminderSettings, encodeReminderSettings } from '@/data/reminder-settings-codec';
import {
  DEFAULT_REMINDER_SETTINGS,
  MINUTES_PER_DAY,
  type ReminderSettings,
} from '@/domain/reminders';

const settingsArb: fc.Arbitrary<ReminderSettings> = fc.record({
  checkIn: fc.record({ on: fc.boolean(), minute: fc.nat({ max: MINUTES_PER_DAY - 1 }) }),
  thought: fc.record({ on: fc.boolean(), minute: fc.nat({ max: MINUTES_PER_DAY - 1 }) }),
  riskHours: fc.boolean(),
  ranks: fc.boolean(),
  checkInSince: fc.option(fc.integer({ min: 0, max: 100_000 }), { nil: null }),
});

describe('reminder settings codec', () => {
  it('reads back what it wrote', () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        expect(decodeReminderSettings(encodeReminderSettings(settings))).toEqual(settings);
      }),
    );
  });

  it('starts with everything off when nothing is stored', () => {
    expect(decodeReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it.each(['', 'not json', '[]', '42', 'null'])('reads %p as the defaults', (text) => {
    expect(decodeReminderSettings(text)).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('falls back field by field, and turns a damaged reminder off', () => {
    const text = JSON.stringify({
      checkIn: { on: true, minute: 2000 },
      thought: { on: 'yes', minute: 450 },
      riskHours: 1,
      ranks: true,
      checkInSince: 1.5,
    });
    expect(decodeReminderSettings(text)).toEqual({
      checkIn: { on: true, minute: DEFAULT_REMINDER_SETTINGS.checkIn.minute },
      thought: { on: false, minute: 450 },
      riskHours: false,
      ranks: true,
      checkInSince: null,
    });
  });

  it('never throws, whatever is stored', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json()), (text) => {
        expect(() => decodeReminderSettings(text)).not.toThrow();
      }),
    );
  });
});
