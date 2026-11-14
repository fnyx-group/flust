import type { TFunction } from 'i18next';

import type { Rank, RankStanding } from '@/domain/ranks';
import { remainingParts, type HoursAndMinutes, type StreakDisplay } from '@/domain/streak';
import { MS_PER_DAY } from '@/domain/time';
import { cleanDayCount, type WeekDay } from '@/domain/week';

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

function rankName(t: TFunction, rank: Rank): string {
  return t(`ranks.names.${rank.id}`);
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

// "Quote of the day: “text”, Seneca".
export function spokenQuote(t: TFunction, text: string, author: string | null): string {
  return author === null
    ? t('home.quote.spoken', { text })
    : t('home.quote.spokenWithAuthor', { text, author });
}
