import { openStorage, type Storage } from '@/data/open-storage';
import { localDayNumber } from '@/domain/local-time';
import { DEFAULT_REMINDER_SETTINGS } from '@/domain/reminders';
import { MS_PER_DAY } from '@/domain/time';
import type { Notifier, ScheduledNotification } from '@/features/reminders/notifier-types';
import { createSerialRunner, syncReminders } from '@/features/reminders/reminder-sync';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { NO_PROTECTION_SETTINGS } from '@test/protection';
import { zoneOffsetAt } from '@test/zones';

const paris = zoneOffsetAt('Europe/Paris');
const NOW = Date.UTC(2026, 2, 2, 9);
const LABELS = { channelName: 'Reminders', channelDescription: 'd', previewPlaceholder: 'p' };

function fakeNotifier(granted = true) {
  const planned: ScheduledNotification[][] = [];
  const notifier: Pick<Notifier, 'getPermission' | 'describe' | 'replace'> = {
    getPermission: async () => ({ granted, canAskAgain: true }),
    describe: jest.fn(async () => undefined),
    replace: async (notifications) => void planned.push([...notifications]),
  };
  return { notifier, planned };
}

async function setUp(started = true) {
  const storage = unwrap(await openStorage(createFakeStorage().deps));
  if (started) {
    unwrap(
      await storage.onboarding.complete({
        journey: journeyOf(NOW - 2 * MS_PER_DAY),
        reasons: [],
        riskMoments: [],
        plans: [],
        ...NO_PROTECTION_SETTINGS,
      }),
    );
  }
  return storage;
}

function sync(
  storage: Storage,
  notifier: Pick<Notifier, 'getPermission' | 'describe' | 'replace'>,
) {
  return syncReminders({
    storage,
    notifier,
    now: NOW,
    offsetAt: paris,
    labels: LABELS,
    bodyOf: (kind) => `text ${kind}`,
  });
}

const CHECK_IN_ON = {
  ...DEFAULT_REMINDER_SETTINGS,
  checkIn: { on: true, minute: 21 * 60 },
  checkInSince: localDayNumber(NOW, paris),
};

describe('syncReminders', () => {
  it('cancels everything while every reminder is off', async () => {
    const storage = await setUp();
    const { notifier, planned } = fakeNotifier();
    expect(await sync(storage, notifier)).toBe('off');
    expect(planned).toEqual([[]]);
  });

  it('cancels everything while notifications are not allowed', async () => {
    const storage = await setUp();
    unwrap(await storage.reminders.save(CHECK_IN_ON));
    const { notifier, planned } = fakeNotifier(false);
    expect(await sync(storage, notifier)).toBe('not-allowed');
    expect(planned).toEqual([[]]);
  });

  it('plans every reminder with its text and screen, and names the channel', async () => {
    const storage = await setUp();
    unwrap(await storage.reminders.save(CHECK_IN_ON));
    const { notifier, planned } = fakeNotifier();

    expect(await sync(storage, notifier)).toBe('planned');
    expect(notifier.describe).toHaveBeenCalledWith(LABELS);
    const notifications = planned[0] ?? [];
    expect(notifications.map((n) => n.id)).toEqual(notifications.map((_, index) => index + 1));
    expect(notifications.at(0)).toMatchObject({ body: 'text check-in', route: '/check-in' });
    expect(notifications.at(-1)).toMatchObject({ body: 'text return', route: '/', floating: true });
  });

  it('skips a day that already has a check-in', async () => {
    const storage = await setUp();
    unwrap(await storage.reminders.save(CHECK_IN_ON));
    const today = localDayNumber(NOW, paris);
    unwrap(
      await storage.checkIns.save(today, NOW, { mood: 3, urge: 'none', context: [], note: null }),
    );
    const { notifier, planned } = fakeNotifier();

    await sync(storage, notifier);
    const days = (planned[0] ?? [])
      .filter((n) => n.route === '/check-in')
      .map((n) => localDayNumber(n.at, paris));
    expect(days).not.toContain(today);
  });

  it('keeps what is planned when storage cannot be read', async () => {
    const storage = await setUp();
    await storage.close();
    const { notifier, planned } = fakeNotifier();
    expect(await sync(storage, notifier)).toBe('storage-failed');
    expect(planned).toEqual([]);
  });
});

describe('createSerialRunner', () => {
  function deferred() {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  it('runs one at a time, then once more for the requests made meanwhile', async () => {
    const gates = [deferred(), deferred()];
    let runs = 0;
    const run = createSerialRunner(async () => {
      const gate = gates[runs];
      runs += 1;
      await gate?.promise;
    });

    const first = run();
    void run();
    void run();
    expect(runs).toBe(1);
    gates[0]?.resolve();
    await new Promise((done) => setTimeout(done, 0));
    expect(runs).toBe(2);
    gates[1]?.resolve();
    await first;
    expect(runs).toBe(2);

    await run();
    expect(runs).toBe(3);
  });

  it('keeps running after a task fails', async () => {
    let runs = 0;
    const run = createSerialRunner(async () => {
      runs += 1;
      throw new Error('boom');
    });
    await run();
    await run();
    expect(runs).toBe(2);
  });
});
