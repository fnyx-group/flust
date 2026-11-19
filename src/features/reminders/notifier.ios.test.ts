import { MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';
import { notifier } from '@/features/reminders/notifier.ios';
import type { ScheduledNotification } from '@/features/reminders/notifier-types';

// Named mock* so that jest.mock may read it. The test does not import expo-notifications, which
// only notifier.ios.ts may.
const mockListScheduled = jest.fn();

jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => ''),
  getAllScheduledNotificationsAsync: () => mockListScheduled(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { CALENDAR: 'calendar', DATE: 'date' },
}));

const NOW = Date.UTC(2026, 5, 1, 9);

function reminder(id: number, at: number): ScheduledNotification {
  return {
    id,
    body: 'body',
    route: '/',
    local: { year: 2026, month: 6, day: 1, hour: 9, minute: 0 },
    floating: false,
    at,
  };
}

// The fake lists only the given reminders, as iOS does once the others have fired or were lost.
function listed(...ids: number[]) {
  mockListScheduled.mockResolvedValue(ids.map((id) => ({ identifier: String(id) })));
}

describe('iOS notifier', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a plan that is listed in full', async () => {
    listed(1, 2);

    await expect(
      notifier.replace([
        reminder(1, NOW + MS_PER_MINUTE * 5),
        reminder(2, NOW + MS_PER_MINUTE * 9),
      ]),
    ).resolves.toBeUndefined();
  });

  it('throws when a reminder still to come is missing from the list', async () => {
    listed(1);

    await expect(
      notifier.replace([
        reminder(1, NOW + MS_PER_MINUTE * 5),
        reminder(2, NOW + MS_PER_MINUTE * 9),
      ]),
    ).rejects.toThrow('Some reminders were not scheduled.');
  });

  it('does not look for a reminder that may have fired during the check', async () => {
    listed(2);

    await expect(
      notifier.replace([
        reminder(1, NOW + 30 * MS_PER_SECOND),
        reminder(2, NOW + MS_PER_MINUTE * 9),
      ]),
    ).resolves.toBeUndefined();
  });

  it('looks for a reminder due just after the margin', async () => {
    listed(2);

    await expect(
      notifier.replace([
        reminder(1, NOW + MS_PER_MINUTE + MS_PER_SECOND),
        reminder(2, NOW + MS_PER_MINUTE * 9),
      ]),
    ).rejects.toThrow('Some reminders were not scheduled.');
  });
});
