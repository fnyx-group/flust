import { MS_PER_DAY } from '@/domain/time';

type RankDefinition = {
  readonly id: string;
  readonly circle: 1 | 2 | 3 | 4 | 5;
  readonly tier: 1 | 2 | 3;
  readonly threshold: number;
};

export const RANKS = [
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
] as const satisfies readonly RankDefinition[];

export type RankId = (typeof RANKS)[number]['id'];

export type Rank = RankDefinition & { readonly id: RankId };

export type RankUnlock = { readonly highest: Rank; readonly others: readonly Rank[] };

export type RankProgress = {
  readonly current: Rank | null;
  readonly unlocked: readonly RankId[];
  readonly unlock: RankUnlock | null;
  readonly next: { readonly rank: Rank; readonly daysLeft: number } | null;
};

// Before the first rank, progress is measured in time toward the first clean day. Afterwards it
// is total clean days over the next threshold, and full once every rank is unlocked.
export type RankStanding =
  | {
      readonly status: 'pending';
      readonly first: Rank;
      readonly fraction: number;
      readonly msLeft: number;
    }
  | {
      readonly status: 'ranked';
      readonly current: Rank;
      readonly next: Rank | null;
      readonly totalCleanDays: number;
      readonly fraction: number;
    };

const ALL_RANKS: readonly Rank[] = RANKS;
const FIRST_RANK: Rank = RANKS[0];

export function isRankId(value: unknown): value is RankId {
  return ALL_RANKS.some((rank) => rank.id === value);
}

// Unlocked ranks are passed in rather than recomputed, because a backdated lapse can lower
// the total and a rank must never be lost. Ranks unlock in order, so every rank up to the
// highest previously unlocked one counts as unlocked, which also fills gaps in corrupted data.
export function rankProgress(
  previouslyUnlocked: readonly RankId[],
  totalCleanDays: number,
): RankProgress {
  const previousCount = highestIndex(previouslyUnlocked) + 1;
  const unlockedRanks = ALL_RANKS.filter(
    (rank, index) => index < previousCount || rank.threshold <= totalCleanDays,
  );
  const current = unlockedRanks.at(-1) ?? null;
  const nextRank = ALL_RANKS[unlockedRanks.length];
  return {
    current,
    unlocked: unlockedRanks.map((rank) => rank.id),
    unlock: toUnlock(unlockedRanks.slice(previousCount)),
    next: nextRank ? { rank: nextRank, daysLeft: nextRank.threshold - totalCleanDays } : null,
  };
}

function highestIndex(ids: readonly RankId[]): number {
  return Math.max(-1, ...ids.map((id) => ALL_RANKS.findIndex((rank) => rank.id === id)));
}

function toUnlock(newlyUnlocked: readonly Rank[]): RankUnlock | null {
  const highest = newlyUnlocked.at(-1);
  return highest ? { highest, others: newlyUnlocked.slice(0, -1) } : null;
}

// Without a rank, total clean days are 0, so every segment is shorter than a day and the first
// day completes when the current streak reaches 24 hours.
export function rankStanding(
  progress: RankProgress,
  totalCleanDays: number,
  streakMs: number,
): RankStanding {
  if (progress.current === null) {
    return {
      status: 'pending',
      first: FIRST_RANK,
      fraction: clampFraction(streakMs / MS_PER_DAY),
      msLeft: Math.max(0, MS_PER_DAY - streakMs),
    };
  }
  const next = progress.next?.rank ?? null;
  return {
    status: 'ranked',
    current: progress.current,
    next,
    totalCleanDays,
    fraction: next ? clampFraction(totalCleanDays / next.threshold) : 1,
  };
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}
