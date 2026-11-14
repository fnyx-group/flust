import type { TFunction } from 'i18next';

import type { LapseSummary } from '@/domain/lapse';
import { triggerOptions } from '@/domain/onboarding';
import type { PlanTrigger, RiskMomentId } from '@/domain/presets';
import { rankName } from '@/features/shared/rank-labels';
import { spokenStreak } from '@/features/shared/streak-labels';

export type SummaryCardText = {
  readonly value: string;
  readonly caption: string;
  readonly spoken: string;
};

// "47 clean days, kept".
export function totalCard(t: TFunction, { totalCleanDays }: LapseSummary): SummaryCardText {
  const value = String(totalCleanDays);
  const caption = t('lapse.total', { count: totalCleanDays });
  return { value, caption, spoken: `${value} ${caption}` };
}

// "12 days on this streak", or "3 h 20" over "on this streak" for a streak shorter than a day.
export function endedStreakCard(t: TFunction, { endedStreak }: LapseSummary): SummaryCardText {
  if (endedStreak.unit === 'days') {
    const value = String(endedStreak.days);
    const caption = t('lapse.streakDays', { count: endedStreak.days });
    return { value, caption, spoken: `${value} ${caption}` };
  }
  const caption = t('lapse.streakHours');
  return {
    value: t('lapse.streakHoursValue', {
      hours: endedStreak.hours,
      minutes: String(endedStreak.minutes).padStart(2, '0'),
    }),
    caption,
    spoken: `${spokenStreak(t, endedStreak)} ${caption}`,
  };
}

export function keptRank(t: TFunction, { rank }: LapseSummary): string | null {
  return rank === null ? null : t('lapse.rank', { name: rankName(t, rank) });
}

// The triggers the onboarding offers, plus the current one when its risk moment is no longer
// chosen, so the plan shown is always one of the options.
export function lapseTriggers(moments: readonly RiskMomentId[], current: PlanTrigger) {
  const options = triggerOptions(moments);
  return options.includes(current) ? options : [current, ...options];
}
