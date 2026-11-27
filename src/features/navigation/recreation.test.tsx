import { Slot } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';

import { createJourney } from '@/domain/journey';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/time';
import { ClockContext } from '@/features/clock/clock-context';
import type { TickClock } from '@/features/clock/minute-clock';
import { setLocked } from '@/features/lock/held-navigation';
import { LockContext, type LockApi } from '@/features/lock/lock-context';
import { useHeldNavigation } from '@/features/lock/use-held-navigation';
import { useCurrentRoot } from '@/features/navigation/current-root';
import { useRankUnlockTrigger } from '@/features/ranks/use-rank-unlock-trigger';
import type { NotificationRoute } from '@/features/reminders/notification-route';
import { notifier } from '@/features/reminders/notifier';
import { useNotificationTaps } from '@/features/reminders/use-notification-taps';
import { SessionContext, type Session } from '@/features/session/session-context';

// Android recreates the activity when the font size or display size changes: the new root mounts
// before the old one unmounts (docs/decisions/0048-router-per-root.md). These tests mount two
// roots, as the recreation does, and check where the routes that come from outside land.

type MockTapListener = (route: string) => void;

jest.mock('@/features/reminders/notifier', () => {
  const listeners = new Set<MockTapListener>();
  return {
    notifier: {
      takeLaunchTap: async () => null,
      onTap: (listener: MockTapListener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      tap: (...args: Parameters<MockTapListener>) => {
        for (const listener of listeners) listener(...args);
      },
    },
  };
});

function tap(route: NotificationRoute) {
  (notifier as unknown as { tap(route: NotificationRoute): void }).tap(route);
}

function RootLayout() {
  const isCurrentRoot = useCurrentRoot();
  useNotificationTaps(isCurrentRoot);
  useHeldNavigation(isCurrentRoot);
  return <Slot />;
}

const tapRoutes = {
  _layout: RootLayout,
  index: () => <Text>Home</Text>,
  'check-in': () => <Text>Check-in</Text>,
};

afterEach(() => setLocked(false));

describe('after the activity is recreated', () => {
  it('opens a notification tap in the new root only', async () => {
    const old = await renderRouter(tapRoutes);
    const recreated = await renderRouter(tapRoutes);

    await act(async () => tap('/check-in'));

    expect(await recreated.findByText('Check-in')).toBeOnTheScreen();
    expect(old.queryByText('Home')).not.toBeNull();
    expect(old.queryByText('Check-in')).toBeNull();
  });

  it('opens a notification tap once the old root is gone', async () => {
    const old = await renderRouter(tapRoutes);
    const recreated = await renderRouter(tapRoutes);
    await old.unmount();

    await act(async () => tap('/check-in'));

    expect(await recreated.findByText('Check-in')).toBeOnTheScreen();
  });

  it('opens the navigation held during the lock in the new root only', async () => {
    const old = await renderRouter(tapRoutes);
    const recreated = await renderRouter(tapRoutes);
    setLocked(true);
    await act(async () => tap('/check-in'));
    expect(recreated.getByText('Home')).toBeOnTheScreen();

    await act(async () => setLocked(false));

    expect(await recreated.findByText('Check-in')).toBeOnTheScreen();
    expect(old.queryByText('Check-in')).toBeNull();
  });

  it('opens the navigation held during the lock once the old root is gone', async () => {
    const old = await renderRouter(tapRoutes);
    const recreated = await renderRouter(tapRoutes);
    setLocked(true);
    await act(async () => tap('/check-in'));
    await old.unmount();

    await act(async () => setLocked(false));

    expect(await recreated.findByText('Check-in')).toBeOnTheScreen();
  });

  it('shows a rank unlocked once the old root is gone', async () => {
    const start = Date.UTC(2026, 10, 20, 12);
    const created = createJourney(start, start);
    if (!created.ok) throw new Error('The journey fixture is invalid.');
    const journey = created.value;
    let now = start + 12 * MS_PER_HOUR;
    const listeners = new Set<() => void>();
    const clock: TickClock = {
      now: () => now,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const lock = { locked: false } as LockApi;

    function Home() {
      useRankUnlockTrigger(journey, [], null);
      return <Text>Home</Text>;
    }

    function RankRoot() {
      const [announced, setAnnounced] = useState(false);
      const session = useMemo(
        () =>
          ({
            announceUnlock: () => {
              if (announced) return false;
              setAnnounced(true);
              return true;
            },
          }) as unknown as Session,
        [announced],
      );
      return (
        <ClockContext value={clock}>
          <LockContext value={lock}>
            <SessionContext value={session}>
              <Slot />
            </SessionContext>
          </LockContext>
        </ClockContext>
      );
    }

    const rankRoutes = {
      _layout: RankRoot,
      index: Home,
      'rank-unlocked': () => <Text>Rank unlocked</Text>,
    };
    const old = await renderRouter(rankRoutes);
    const recreated = await renderRouter(rankRoutes);
    await old.unmount();

    now = start + MS_PER_DAY + MS_PER_HOUR;
    await act(async () => {
      for (const listener of listeners) listener();
    });

    expect(await recreated.findByText('Rank unlocked')).toBeOnTheScreen();
  });
});
