import type { TFunction } from 'i18next';

import type { BreathingPhase, MinutesAndSeconds } from '@/domain/urge';

// "19:42", the same in every language.
export function countdownText({ minutes, seconds }: MinutesAndSeconds): string {
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// "19 minutes 42 seconds left": screen readers would read "19:42" as a time of day.
export function spokenCountdown(t: TFunction, { minutes, seconds }: MinutesAndSeconds): string {
  const parts = [
    minutes > 0 ? t('units.minute', { count: minutes }) : null,
    seconds > 0 || minutes === 0 ? t('units.second', { count: seconds }) : null,
  ].filter((part) => part !== null);
  const [first, second] = parts;
  const time =
    second === undefined
      ? first
      : t('emergency.countdownTime', { minutes: first, seconds: second });
  return t('emergency.countdownSpoken', { time });
}

export function breathingLabel(t: TFunction, phase: BreathingPhase): string {
  return t(`emergency.breathing.${phase}`);
}
