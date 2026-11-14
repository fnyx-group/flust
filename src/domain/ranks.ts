export type RankId =
  | 'novice'
  | 'apprentice'
  | 'initiate'
  | 'watcher'
  | 'black-mage'
  | 'sorcerer'
  | 'white-mage'
  | 'silver-mage'
  | 'archmage'
  | 'sovereign'
  | 'scarlet-mage'
  | 'free-soul';

export type Rank = {
  readonly id: RankId;
  readonly circle: 1 | 2 | 3 | 4 | 5;
  readonly tier: 1 | 2 | 3;
  readonly threshold: number;
};

type RankUnlock = { highest: Rank; others: readonly Rank[] };

export type RankProgress = {
  current: Rank | null;
  unlocked: readonly RankId[];
  unlock: RankUnlock | null;
  next: { rank: Rank; daysLeft: number } | null;
};

export const RANKS: readonly Rank[] = [
  { id: 'novice', circle: 1, tier: 1, threshold: 1 },
  { id: 'apprentice', circle: 1, tier: 2, threshold: 3 },
  { id: 'initiate', circle: 1, tier: 3, threshold: 7 },
  { id: 'watcher', circle: 2, tier: 1, threshold: 14 },
  { id: 'black-mage', circle: 2, tier: 2, threshold: 30 },
  { id: 'sorcerer', circle: 2, tier: 3, threshold: 45 },
  { id: 'white-mage', circle: 3, tier: 1, threshold: 60 },
  { id: 'silver-mage', circle: 3, tier: 2, threshold: 90 },
  { id: 'archmage', circle: 3, tier: 3, threshold: 120 },
  { id: 'sovereign', circle: 4, tier: 1, threshold: 180 },
  { id: 'scarlet-mage', circle: 4, tier: 2, threshold: 270 },
  { id: 'free-soul', circle: 5, tier: 1, threshold: 365 },
];

export function isRankId(value: string): value is RankId {
  return RANKS.some((rank) => rank.id === value);
}

// Unlocked ranks are passed in rather than recomputed, because a backdated lapse can lower
// the total and a rank must never be lost.
export function rankProgress(
  previouslyUnlocked: readonly RankId[],
  totalCleanDays: number,
): RankProgress {
  const previous = new Set(previouslyUnlocked);
  const unlockedRanks = RANKS.filter(
    (rank) => previous.has(rank.id) || rank.threshold <= totalCleanDays,
  );
  const newlyUnlocked = unlockedRanks.filter((rank) => !previous.has(rank.id));
  const current = unlockedRanks.at(-1) ?? null;
  const nextRank = RANKS.find((rank) => rank.threshold > (current?.threshold ?? 0));
  return {
    current,
    unlocked: unlockedRanks.map((rank) => rank.id),
    unlock: toUnlock(newlyUnlocked),
    next: nextRank ? { rank: nextRank, daysLeft: nextRank.threshold - totalCleanDays } : null,
  };
}

function toUnlock(newlyUnlocked: readonly Rank[]): RankUnlock | null {
  const highest = newlyUnlocked.at(-1);
  return highest ? { highest, others: newlyUnlocked.slice(0, -1) } : null;
}
