import { unlockFromIds, type RankId, type RankUnlock } from '@/domain/ranks';

export type UnlockParams = { ranks: string; days: string };

export type UnlockScreenData = { readonly unlock: RankUnlock; readonly totalCleanDays: number };

export function toUnlockParams(ids: readonly RankId[], totalCleanDays: number): UnlockParams {
  return { ranks: ids.join(','), days: String(totalCleanDays) };
}

// Route parameters can come from a deep link, so anything malformed is refused.
export function fromUnlockParams(params: {
  ranks?: string | string[];
  days?: string | string[];
}): UnlockScreenData | null {
  if (typeof params.ranks !== 'string' || typeof params.days !== 'string') return null;
  if (!/^\d+$/.test(params.days)) return null;
  const unlock = unlockFromIds(params.ranks.split(','));
  return unlock ? { unlock, totalCleanDays: Number(params.days) } : null;
}
