import type { TFunction } from 'i18next';

import type { BreathingPhase, MinutesAndSeconds } from '@/domain/urge';

// Whole minutes left, rounded up, so the chip never reads "0 min" while time remains and starts
// at the full 20.
function minutesLeft({ minutes, seconds }: MinutesAndSeconds): number {
  return seconds > 0 ? minutes + 1 : minutes;
}

// "19 min".
export function countdownText(t: TFunction, parts: MinutesAndSeconds): string {
  return t('emergency.countdown', { count: minutesLeft(parts) });
}

// "19 minutes left", the same minutes as the chip, in words.
export function spokenCountdown(t: TFunction, parts: MinutesAndSeconds): string {
  return t('emergency.countdownSpoken', {
    time: t('units.minute', { count: minutesLeft(parts) }),
  });
}

export function breathingLabel(t: TFunction, phase: BreathingPhase): string {
  return t(`emergency.breathing.${phase}`);
}
