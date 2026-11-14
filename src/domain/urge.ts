import { isOneOf } from '@/domain/guards';
import { elapsedMs, MS_PER_MINUTE, MS_PER_SECOND, type Timestamp } from '@/domain/time';

// An urge rises, peaks and falls, often within 15 to 30 minutes.
export const URGE_WAVE_MS = 20 * MS_PER_MINUTE;

export const URGE_OUTCOMES = ['held', 'lapse', 'closed'] as const;

export type UrgeOutcome = (typeof URGE_OUTCOMES)[number];

export const isUrgeOutcome = isOneOf(URGE_OUTCOMES);

export type MinutesAndSeconds = { readonly minutes: number; readonly seconds: number };

// Computed from the opening time, so a call or the app in the background never stops it. A clock
// moved backwards shows the full wave, never more.
export function countdownMs(openedAt: Timestamp, now: Timestamp): number {
  return Math.max(0, URGE_WAVE_MS - elapsedMs(openedAt, now));
}

// Rounded up to the second, so the countdown shows 20:00 when it opens and 00:00 only at the end.
export function countdownParts(ms: number): MinutesAndSeconds {
  const seconds = Math.ceil(Math.max(0, ms) / MS_PER_SECOND);
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}

export type BreathingPhase = 'inhale' | 'hold' | 'exhale';

const INHALE_MS = 4 * MS_PER_SECOND;
const HOLD_MS = 4 * MS_PER_SECOND;
const EXHALE_MS = 6 * MS_PER_SECOND;
const CYCLE_MS = INHALE_MS + HOLD_MS + EXHALE_MS;

export type BreathingStep = {
  readonly phase: BreathingPhase;
  // Counts down within the phase: 4 to 1, then 6 to 1 for the exhale.
  readonly secondsLeft: number;
  // Grows by one with every phase across cycles, so a new phase is easy to detect.
  readonly index: number;
  // How far into the phase, from 0 to 1, so an animation can resume where it should be.
  readonly progress: number;
  readonly msLeft: number;
};

// Breathing runs on the time elapsed since opening, so it resumes in the right phase after the
// app comes back from the background.
export function breathingStep(elapsed: number): BreathingStep {
  const ms = Math.max(0, elapsed);
  const cycle = Math.floor(ms / CYCLE_MS);
  const intoCycle = ms - cycle * CYCLE_MS;
  const first = cycle * 3;
  if (intoCycle < INHALE_MS) return step('inhale', first, intoCycle, INHALE_MS);
  if (intoCycle < INHALE_MS + HOLD_MS) {
    return step('hold', first + 1, intoCycle - INHALE_MS, HOLD_MS);
  }
  return step('exhale', first + 2, intoCycle - INHALE_MS - HOLD_MS, EXHALE_MS);
}

function step(phase: BreathingPhase, index: number, into: number, length: number): BreathingStep {
  const msLeft = length - into;
  return {
    phase,
    secondsLeft: Math.ceil(msLeft / MS_PER_SECOND),
    index,
    progress: into / length,
    msLeft,
  };
}
