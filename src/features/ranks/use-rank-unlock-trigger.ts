import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';

import type { Journey } from '@/domain/journey';
import type { LapseRecord } from '@/domain/lapse';
import type { PendingUnlock, RankId } from '@/domain/ranks';
import { useClock } from '@/features/clock/clock-context';
import { useLock } from '@/features/lock/lock-context';
import { toUnlockParams } from '@/features/ranks/unlock-params';
import { unlockToShow } from '@/features/ranks/unlock-to-show';
import { useSession } from '@/features/session/session-context';

function samePending(a: PendingUnlock | null, b: PendingUnlock | null): boolean {
  return (
    a?.unlock.highest === b?.unlock.highest &&
    a?.unlock.others.length === b?.unlock.others.length &&
    a?.totalCleanDays === b?.totalCleanDays
  );
}

// Checked on each tick of the home clock, which also ticks when the app returns to the
// foreground, and whenever Home gets the focus back. Only while Home is focused, so the unlock
// screen never covers the emergency screen or another tab, and waits for the navigation that
// follows the onboarding to settle. Held during the hours after a lapse (see unlockToShow), and
// while the app is locked, so a rank is recorded and shown only once the person is back in.
export function useRankUnlockTrigger(
  journey: Journey,
  unlockedRanks: readonly RankId[],
  latestLapse: LapseRecord | null,
) {
  const { announceUnlock } = useSession();
  const { locked } = useLock();
  const focused = useIsFocused();
  const pending = useClock(
    (now) => unlockToShow(journey, unlockedRanks, latestLapse, now),
    samePending,
  );

  useEffect(() => {
    if (!focused || locked || pending === null) return;
    const { highest, others } = pending.unlock;
    const ids = [...others, highest].map((rank) => rank.id);
    if (!announceUnlock(ids)) return;
    router.push({
      pathname: '/rank-unlocked',
      params: toUnlockParams(ids, pending.totalCleanDays),
    });
  }, [focused, locked, pending, announceUnlock]);
}
