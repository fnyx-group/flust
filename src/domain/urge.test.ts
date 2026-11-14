import * as fc from 'fast-check';

import { MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';
import {
  breathingStep,
  countdownMs,
  countdownParts,
  isUrgeOutcome,
  URGE_OUTCOMES,
  URGE_WAVE_MS,
} from '@/domain/urge';
import { duration } from '@test/arbitraries';

describe('countdownMs', () => {
  it('starts at 20 minutes and counts down with the time elapsed', () => {
    expect(countdownMs(0)).toBe(20 * MS_PER_MINUTE);
    expect(countdownMs(3 * MS_PER_MINUTE)).toBe(17 * MS_PER_MINUTE);
  });

  it('stays at zero once the wave is over', () => {
    expect(countdownMs(URGE_WAVE_MS)).toBe(0);
    expect(countdownMs(3 * URGE_WAVE_MS)).toBe(0);
  });

  it('always lies between zero and the full wave', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (elapsed) => {
        const left = countdownMs(elapsed);
        return left >= 0 && left <= URGE_WAVE_MS;
      }),
    );
  });
});

describe('countdownParts', () => {
  it('rounds up to the second', () => {
    expect(countdownParts(URGE_WAVE_MS)).toEqual({ minutes: 20, seconds: 0 });
    expect(countdownParts(URGE_WAVE_MS - 400)).toEqual({ minutes: 20, seconds: 0 });
    expect(countdownParts(URGE_WAVE_MS - MS_PER_SECOND)).toEqual({ minutes: 19, seconds: 59 });
    expect(countdownParts(1)).toEqual({ minutes: 0, seconds: 1 });
    expect(countdownParts(0)).toEqual({ minutes: 0, seconds: 0 });
  });

  it('never goes below zero', () => {
    expect(countdownParts(-5)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe('breathingStep', () => {
  it.each([
    [0, 'inhale', 4, 0],
    [999, 'inhale', 4, 0],
    [1000, 'inhale', 3, 0],
    [3999, 'inhale', 1, 0],
    [4000, 'hold', 4, 1],
    [7999, 'hold', 1, 1],
    [8000, 'exhale', 6, 2],
    [13_999, 'exhale', 1, 2],
    [14_000, 'inhale', 4, 3],
    [28_000, 'inhale', 4, 6],
    [36_000, 'exhale', 6, 8],
  ] as const)('at %i ms: %s, %i seconds left, step %i', (elapsed, phase, secondsLeft, index) => {
    const step = breathingStep(elapsed);
    expect(step.phase).toBe(phase);
    expect(step.secondsLeft).toBe(secondsLeft);
    expect(step.index).toBe(index);
  });

  it('tells how far into the phase it is, so an animation can resume there', () => {
    expect(breathingStep(2000)).toMatchObject({ progress: 0.5, msLeft: 2000 });
    expect(breathingStep(11_000)).toMatchObject({ progress: 0.5, msLeft: 3000 });
  });

  it('starts with the inhale when the clock is behind the opening time', () => {
    expect(breathingStep(-5000)).toMatchObject({ phase: 'inhale', secondsLeft: 4, index: 0 });
  });

  it('moves through the phases in order, one step at a time', () => {
    fc.assert(
      fc.property(duration, (elapsed) => {
        const step = breathingStep(elapsed);
        const next = breathingStep(elapsed + step.msLeft);
        return (
          next.index === step.index + 1 &&
          next.phase === (['inhale', 'hold', 'exhale'] as const)[next.index % 3] &&
          step.secondsLeft >= 1 &&
          step.progress >= 0 &&
          step.progress < 1
        );
      }),
    );
  });
});

describe('urge outcomes', () => {
  it('recognize their own values only', () => {
    expect(URGE_OUTCOMES.every(isUrgeOutcome)).toBe(true);
    expect(isUrgeOutcome('relapse')).toBe(false);
    expect(isUrgeOutcome(null)).toBe(false);
  });
});
