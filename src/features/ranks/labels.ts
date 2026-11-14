import type { TFunction } from 'i18next';

import type { Rank, RankCell, RankStanding, RankUnlock } from '@/domain/ranks';
import { rankBadgeText } from '@/features/home/labels';
import { rankName } from '@/features/shared/rank-labels';

// Punctuation only, so the same in every language.
const HIDDEN_NAME = '???';

const ROMAN: Record<Rank['circle'], string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

// "Cercle II · Ombre". Screen readers get the Arabic number, since they read "II" letter by letter.
export function circleLabel(t: TFunction, circle: Rank['circle']): string {
  return t('ranks.screen.circle', { number: ROMAN[circle], name: t(`ranks.circles.${circle}`) });
}

function spokenCircle(t: TFunction, circle: Rank['circle']): string {
  return t('ranks.screen.circleSpoken', { number: circle, name: t(`ranks.circles.${circle}`) });
}

export type CurrentRankText = {
  readonly rank: Rank;
  readonly unlocked: boolean;
  readonly circle: string;
  readonly name: string;
  readonly detail: string;
  readonly spokenLabel: string;
};

// Before day one the card says what the home badge says: the first rank, locked, and the time
// left to it.
export function currentRankText(t: TFunction, standing: RankStanding): CurrentRankText {
  const rank = standing.status === 'pending' ? standing.first : standing.current;
  const circle = circleLabel(t, rank.circle);
  const spokenRankCircle = spokenCircle(t, rank.circle);
  if (standing.status === 'pending') {
    const badge = rankBadgeText(t, standing);
    return {
      rank,
      unlocked: false,
      circle,
      name: badge.name,
      detail: badge.detail,
      spokenLabel: `${badge.spokenLabel}, ${spokenRankCircle}`,
    };
  }
  const { next, totalCleanDays } = standing;
  const name = rankName(t, rank);
  const detail = next
    ? t('ranks.screen.nextIn', { count: next.threshold - totalCleanDays })
    : t('ranks.screen.allUnlocked');
  return {
    rank,
    unlocked: true,
    circle,
    name,
    detail,
    spokenLabel: t('ranks.screen.spoken', { name, circle: spokenRankCircle, detail }),
  };
}

export type RankCellText = { readonly name: string; readonly spokenLabel: string };

export function rankCellText(t: TFunction, { rank, state, nameVisible }: RankCell): RankCellText {
  const name = nameVisible ? rankName(t, rank) : HIDDEN_NAME;
  return {
    name,
    spokenLabel: t('ranks.screen.cellSpoken', {
      name: nameVisible ? name : t('ranks.screen.lockedName'),
      circle: t('ranks.screen.cellCircle', { number: rank.circle }),
      status: t(`ranks.screen.status.${state}`),
      days: t('units.day', { count: rank.threshold }),
    }),
  };
}

export type UnlockText = {
  readonly name: string;
  readonly circle: string;
  readonly line: string;
  readonly others: string | null;
  readonly announcement: string;
};

export function unlockText(t: TFunction, unlock: RankUnlock, totalCleanDays: number): UnlockText {
  const { highest, others } = unlock;
  const name = rankName(t, highest);
  const circleLine =
    highest.tier === 1
      ? t(`ranks.unlocked.opens.${highest.circle}`)
      : t(`ranks.unlocked.advances.${highest.circle}`);
  return {
    name,
    circle: circleLabel(t, highest.circle),
    line: t('ranks.unlocked.line', {
      days: t('ranks.unlocked.days', { count: totalCleanDays }),
      circle: circleLine,
    }),
    others:
      others.length === 0
        ? null
        : t('ranks.unlocked.others', {
            count: others.length,
            names: others.map((rank) => rankName(t, rank)).join(t('ranks.unlocked.listSeparator')),
          }),
    announcement: t('ranks.unlocked.spoken', { name, circle: spokenCircle(t, highest.circle) }),
  };
}
