import type { TFunction } from 'i18next';

import type { Rank, RankStanding } from '@/domain/ranks';
import { remainingParts, type HoursAndMinutes, type StreakDisplay } from '@/domain/streak';

const CIRCLE_NUMERALS: Record<Rank['circle'], string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
};

export function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

// What a screen reader says for the counter: "12 days", "7 hours 40 minutes".
export function spokenStreak(t: TFunction, display: StreakDisplay): string {
  return display.unit === 'days'
    ? t('units.day', { count: display.days })
    : spokenHoursMinutes(t, display);
}

function spokenHoursMinutes(t: TFunction, { hours, minutes }: HoursAndMinutes): string {
  const spokenMinutes = t('units.minute', { count: minutes });
  if (hours === 0) return spokenMinutes;
  return t('home.streak.spokenHoursMinutes', {
    hours: t('units.hour', { count: hours }),
    minutes: spokenMinutes,
  });
}

export type RankCardText = {
  readonly rank: Rank;
  readonly unlocked: boolean;
  readonly eyebrow: string;
  readonly name: string;
  readonly progress: string;
  readonly target: string;
  // The card is a single button, so it announces the progress itself, in full words.
  readonly spokenProgress: string;
};

export function rankCardText(t: TFunction, standing: RankStanding): RankCardText {
  if (standing.status === 'pending') {
    const left = remainingParts(standing.msLeft);
    const target = t('units.day', { count: standing.first.threshold });
    return {
      rank: standing.first,
      unlocked: false,
      eyebrow: t('home.rank.first'),
      name: rankName(t, standing.first),
      progress: t('home.rank.unlocksIn', {
        time: t('home.rank.shortTime', { hours: left.hours, minutes: twoDigits(left.minutes) }),
      }),
      target,
      spokenProgress: t('home.rank.summary', {
        progress: t('home.rank.unlocksIn', { time: spokenHoursMinutes(t, left) }),
        target,
      }),
    };
  }
  const { current, next, totalCleanDays } = standing;
  const progress = t('home.rank.cleanDays', { count: totalCleanDays });
  const allUnlocked = t('home.rank.allUnlocked');
  const target = next
    ? t('home.rank.nextAt', { name: rankName(t, next), count: next.threshold })
    : allUnlocked;
  const spokenTarget = next
    ? t('home.rank.nextAtSpoken', { name: rankName(t, next), count: next.threshold })
    : allUnlocked;
  return {
    rank: current,
    unlocked: true,
    eyebrow: t('home.rank.circle', {
      numeral: CIRCLE_NUMERALS[current.circle],
      name: t(`ranks.circles.${current.circle}`),
    }),
    name: rankName(t, current),
    progress,
    target,
    spokenProgress: t('home.rank.summary', { progress, target: spokenTarget }),
  };
}

function rankName(t: TFunction, rank: Rank): string {
  return t(`ranks.names.${rank.id}`);
}
