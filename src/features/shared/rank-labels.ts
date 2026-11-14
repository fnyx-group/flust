import type { TFunction } from 'i18next';

import type { Rank } from '@/domain/ranks';

export function rankName(t: TFunction, rank: Rank): string {
  return t(`ranks.names.${rank.id}`);
}
