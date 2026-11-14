import type { Journey } from '@/domain/journey';
import { inSupportWindow, type LapseRecord } from '@/domain/lapse';
import { pendingUnlock, type PendingUnlock, type RankId } from '@/domain/ranks';
import type { Timestamp } from '@/domain/time';

// No unlock screen in the hours after a lapse is logged: the rank is kept, shown on the badge at
// once, and announced when that window ends.
export function unlockToShow(
  journey: Journey,
  unlockedRanks: readonly RankId[],
  latestLapse: LapseRecord | null,
  now: Timestamp,
): PendingUnlock | null {
  if (inSupportWindow(latestLapse, now)) return null;
  return pendingUnlock(journey, unlockedRanks, now);
}
