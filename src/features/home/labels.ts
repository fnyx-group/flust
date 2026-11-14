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

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export type CounterPart = { readonly kind: 'number' | 'unit'; readonly text: string };

// The counter as it is drawn: numbers in the counter font, units with their surrounding spaces in
// the unit style. The width test measures these same parts.
export function counterParts(t: TFunction, display: StreakDisplay): CounterPart[] {
  if (display.unit === 'days') {
    return [
      { kind: 'number', text: String(display.days) },
      { kind: 'unit', text: ` ${t('home.streak.dayUnit', { count: display.days })}` },
    ];
  }
  return [
    { kind: 'number', text: String(display.hours) },
    { kind: 'unit', text: ` ${t('home.streak.hourUnit')} ` },
    { kind: 'number', text: twoDigits(display.minutes) },
    { kind: 'unit', text: ` ${t('home.streak.minuteUnit')}` },
  ];
}

// What a screen reader says for the counter: "Current streak: 7 hours 40 minutes".
export function spokenCounter(t: TFunction, display: StreakDisplay): string {
  return t('home.streak.spoken', { value: spokenStreak(t, display) });
}

// "12 days", "7 hours 40 minutes", "1 hour".
export function spokenStreak(t: TFunction, display: StreakDisplay): string {
  return display.unit === 'days'
    ? t('units.day', { count: display.days })
    : spokenHoursMinutes(t, display);
}

function spokenHoursMinutes(t: TFunction, { hours, minutes }: HoursAndMinutes): string {
  const spokenMinutes = t('units.minute', { count: minutes });
  if (hours === 0) return spokenMinutes;
  const spokenHours = t('units.hour', { count: hours });
  if (minutes === 0) return spokenHours;
  return t('home.streak.spokenHoursMinutes', { hours: spokenHours, minutes: spokenMinutes });
}

export type RankCardText = {
  readonly rank: Rank;
  readonly unlocked: boolean;
  readonly eyebrow: string;
  readonly name: string;
  readonly progress: string;
  readonly target: string;
  // The card is a single button, so its one label says everything on it, in full words.
  readonly spokenLabel: string;
};

export function rankCardText(t: TFunction, standing: RankStanding): RankCardText {
  if (standing.status === 'pending') {
    const left = remainingParts(standing.msLeft);
    const eyebrow = t('home.rank.first');
    const name = rankName(t, standing.first);
    const target = t('units.day', { count: standing.first.threshold });
    return {
      rank: standing.first,
      unlocked: false,
      eyebrow,
      name,
      progress: t('home.rank.unlocksIn', {
        time: t('home.rank.shortTime', { hours: left.hours, minutes: twoDigits(left.minutes) }),
      }),
      target,
      spokenLabel: t('home.rank.spoken', {
        name,
        eyebrow,
        progress: t('home.rank.unlocksIn', { time: spokenHoursMinutes(t, left) }),
        target,
      }),
    };
  }
  const { current, next, totalCleanDays } = standing;
  const eyebrow = t('home.rank.circle', {
    numeral: CIRCLE_NUMERALS[current.circle],
    name: t(`ranks.circles.${current.circle}`),
  });
  const name = rankName(t, current);
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
    eyebrow,
    name,
    progress,
    target,
    spokenLabel: t('home.rank.spoken', { name, eyebrow, progress, target: spokenTarget }),
  };
}

function rankName(t: TFunction, rank: Rank): string {
  return t(`ranks.names.${rank.id}`);
}
