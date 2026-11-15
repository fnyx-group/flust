import type { Storage } from '@/data/open-storage';
import { localDayNumber, type UtcOffsetAt } from '@/domain/local-time';
import { anyReminderOn, planReminders, type ReminderKind } from '@/domain/reminders';
import type { Timestamp } from '@/domain/time';
import { routeOf } from '@/features/reminders/notification-route';
import type {
  NotificationLabels,
  Notifier,
  ScheduledNotification,
} from '@/features/reminders/notifier-types';

// Enough days of check-ins for the spacing, which pauses a week after the last one.
const CHECK_IN_DAYS = 14;

export type ReminderSyncDeps = {
  readonly storage: Pick<
    Storage,
    'reminders' | 'profile' | 'checkIns' | 'journey' | 'ranks' | 'lapses'
  >;
  readonly notifier: Pick<Notifier, 'getPermission' | 'describe' | 'replace'>;
  readonly now: Timestamp;
  readonly offsetAt: UtcOffsetAt;
  readonly labels: NotificationLabels;
  readonly bodyOf: (kind: ReminderKind) => string;
};

export type ReminderSyncOutcome = 'planned' | 'off' | 'not-allowed' | 'storage-failed';

// Plans every reminder again from now. When storage cannot be read, the reminders already
// planned stay as they are rather than being lost.
export async function syncReminders(deps: ReminderSyncDeps): Promise<ReminderSyncOutcome> {
  const { storage, notifier, now, offsetAt } = deps;
  const settings = await storage.reminders.load();
  if (!settings.ok) return 'storage-failed';
  if (!anyReminderOn(settings.value)) {
    await notifier.replace([]);
    return 'off';
  }
  const permission = await notifier.getPermission();
  if (!permission.granted) {
    await notifier.replace([]);
    return 'not-allowed';
  }
  const today = localDayNumber(now, offsetAt);
  const [journey, unlockedRanks, latestLapse, profile, checkIns] = await Promise.all([
    storage.journey.load(),
    storage.ranks.loadUnlocked(),
    storage.lapses.latest(),
    storage.profile.load(),
    storage.checkIns.since(today - CHECK_IN_DAYS),
  ]);
  if (!journey.ok || !unlockedRanks.ok || !latestLapse.ok || !profile.ok || !checkIns.ok) {
    return 'storage-failed';
  }
  const planned = planReminders(
    {
      settings: settings.value,
      riskMoments: profile.value.riskMoments,
      checkInDays: checkIns.value.map((checkIn) => checkIn.day),
      journey: journey.value,
      unlockedRanks: unlockedRanks.value,
      latestLapse: latestLapse.value,
    },
    now,
    offsetAt,
  );
  const notifications: ScheduledNotification[] = planned.map((reminder, index) => ({
    id: index + 1,
    body: deps.bodyOf(reminder.kind),
    route: routeOf(reminder.kind),
    local: reminder.local,
    floating: reminder.floating,
    at: reminder.at,
  }));
  await notifier.describe(deps.labels);
  await notifier.replace(notifications);
  return 'planned';
}

// Syncs one at a time. A request made while one runs starts one more afterwards, with the data
// as it is then, and further requests meanwhile join it.
export function createSerialRunner(task: () => Promise<unknown>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;

  async function loop(): Promise<void> {
    do {
      again = false;
      await task().catch(() => undefined);
    } while (again);
    running = null;
  }

  return () => {
    if (running !== null) {
      again = true;
      return running;
    }
    running = loop();
    return running;
  };
}
