import type { TFunction } from 'i18next';

import type { Rank, RankCell, RankStanding, RankUnlock } from '@/domain/ranks';
import { MS_PER_DAY } from '@/domain/time';
import { cleanDayCount, type WeekDay } from '@/domain/week';
import { rankLineText } from '@/features/home/labels';
import { rankName } from '@/features/shared/rank-labels';

// Punctuation only, so the same in every language.
const HIDDEN_NAME = '???';

const ROMAN: Record<Rank['circle'], string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

// Written before the circle name in the grid. Screen readers get the Arabic number instead, since
// they read "II" letter by letter.
export function romanNumeral(circle: Rank['circle']): string {
  return ROMAN[circle];
}

// "Cercle de l'Ombre".
export function circleName(t: TFunction, circle: Rank['circle']): string {
  return t(`ranks.circleNames.${circle}`);
}

export type CircleGroup = { readonly circle: Rank['circle']; readonly cells: readonly RankCell[] };

// The grid cells in one group per circle, in rank order.
export function circleGroups(cells: readonly RankCell[]): CircleGroup[] {
  const groups: CircleGroup[] = [];
  for (const cell of cells) {
    const last = groups.at(-1);
    if (last?.circle === cell.rank.circle)
      groups[groups.length - 1] = { ...last, cells: [...last.cells, cell] };
    else groups.push({ circle: cell.rank.circle, cells: [cell] });
  }
  return groups;
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
  // Under the progress bar: the total on the left, the next threshold on the right.
  readonly total: string;
  readonly target: string | null;
  readonly spokenLabel: string;
};

// Before day one the card says what the home rank line says: the first rank, locked, and the time
// left to it.
export function currentRankText(t: TFunction, standing: RankStanding): CurrentRankText {
  const rank = standing.status === 'pending' ? standing.first : standing.current;
  const circle = circleName(t, rank.circle);
  const spokenRankCircle = spokenCircle(t, rank.circle);
  if (standing.status === 'pending') {
    const line = rankLineText(t, standing);
    return {
      rank,
      unlocked: false,
      circle,
      name: line.name,
      detail: line.detail,
      total: t('ranks.screen.totalDays', { count: 0 }),
      target: t('ranks.screen.nextAt', { name: rankName(t, rank), count: rank.threshold }),
      spokenLabel: `${line.spokenLabel}, ${spokenRankCircle}`,
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
    total: t('ranks.screen.totalDays', { count: totalCleanDays }),
    target: next && t('ranks.screen.nextAt', { name: rankName(t, next), count: next.threshold }),
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
    circle: circleName(t, highest.circle),
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

// "6 clean days in the last 7".
export function spokenWeek(t: TFunction, week: readonly WeekDay[]): string {
  return t('ranks.week.summary', { count: cleanDayCount(week) });
}

// Local day numbers count days from 1970-01-01, so formatting the day's start in UTC gives its
// weekday without the device time zone shifting it a second time.
export function weekdayInitial(language: string, day: number): string {
  return new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' }).format(
    day * MS_PER_DAY,
  );
}
