import type { TFunction } from 'i18next';

import type { Rank, RankStanding } from '@/domain/ranks';
import { remainingParts, type StreakDisplay } from '@/domain/streak';
import { MS_PER_DAY } from '@/domain/time';
import { cleanDayCount, type WeekDay } from '@/domain/week';
import { rankName } from '@/features/shared/rank-labels';
import { spokenHoursMinutes, spokenStreak } from '@/features/shared/streak-labels';

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export type CounterParts = {
  readonly number: string;
  readonly unit: string;
  // The minutes after the hours, on a quieter line, or null.
  readonly rest: string | null;
};

// The counter as it is drawn in its ring: "7", "heures", "et 40 min". The width test measures the
// number.
export function counterParts(t: TFunction, display: StreakDisplay): CounterParts {
  if (display.unit === 'days') {
    return {
      number: String(display.days),
      unit: t('home.streak.dayUnit', { count: display.days }),
      rest: null,
    };
  }
  return {
    number: String(display.hours),
    unit: t('home.streak.hourUnit', { count: display.hours }),
    rest: display.minutes === 0 ? null : t('home.streak.minutesRest', { count: display.minutes }),
  };
}

// What a screen reader says for the counter: "Current streak, 7 hours 40 minutes".
export function spokenCounter(t: TFunction, display: StreakDisplay): string {
  return t('home.streak.spoken', { value: spokenStreak(t, display) });
}

export type RankBadgeText = {
  readonly rank: Rank;
  readonly unlocked: boolean;
  readonly name: string;
  readonly detail: string;
  // The badge is a single button, so its one label says everything on it, in full words.
  readonly spokenLabel: string;
};

// Before day one the badge shows the first rank, locked, and the time left to it.
export function rankBadgeText(t: TFunction, standing: RankStanding): RankBadgeText {
  if (standing.status === 'pending') {
    const left = remainingParts(standing.msLeft);
    const firstName = rankName(t, standing.first);
    const name = t('home.rank.first');
    const detail = t('home.rank.firstIn', {
      name: firstName,
      time: t('home.rank.shortTime', { hours: left.hours, minutes: twoDigits(left.minutes) }),
    });
    const spokenDetail = t('home.rank.firstIn', {
      name: firstName,
      time: spokenHoursMinutes(t, left),
    });
    return {
      rank: standing.first,
      unlocked: false,
      name,
      detail,
      spokenLabel: t('home.rank.spoken', { name, detail: spokenDetail }),
    };
  }
  const { current, next, totalCleanDays } = standing;
  const name = rankName(t, current);
  const detail = next
    ? t('home.rank.nextIn', { name: rankName(t, next), count: next.threshold - totalCleanDays })
    : t('home.rank.allUnlocked');
  return {
    rank: current,
    unlocked: true,
    name,
    detail,
    spokenLabel: t('home.rank.spoken', { name, detail }),
  };
}

// "6 clean days in the last 7".
export function spokenWeek(t: TFunction, week: readonly WeekDay[]): string {
  return t('home.week.summary', { count: cleanDayCount(week) });
}

// Local day numbers count days from 1970-01-01, so formatting the day's start in UTC gives its
// weekday without the device time zone shifting it a second time.
export function weekdayInitial(language: string, day: number): string {
  return new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' }).format(
    day * MS_PER_DAY,
  );
}

// The circle in the home header, "Cercle de l'Ombre", or "Premier jour" before the first rank.
export function headerCircle(
  t: TFunction,
  standing: RankStanding,
): { readonly text: string; readonly circle: Rank['circle'] | null } {
  if (standing.status === 'pending') return { text: t('home.firstDay'), circle: null };
  const { circle } = standing.current;
  return { text: t(`ranks.circleNames.${circle}`), circle };
}

// "Quote of the day, text, Seneca".
export function spokenQuote(t: TFunction, text: string, author: string | null): string {
  return author === null
    ? t('home.quote.spoken', { text })
    : t('home.quote.spokenWithAuthor', { text, author });
}
