import * as fc from 'fast-check';

import {
  DEFAULT_LOCK_SETTINGS,
  elapse,
  isLockDelay,
  isWaiting,
  LOCK_DELAYS,
  NO_ATTEMPTS,
  recordFailure,
  resumeAttempts,
  shouldRelock,
  timeAway,
  waitAfter,
  type Attempts,
} from '@/domain/lock';
import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from '@/domain/time';

const attemptsArb = fc.record({
  failures: fc.nat({ max: 50 }),
  waitMs: fc.nat({ max: 2 * MS_PER_HOUR }),
});

describe('waitAfter', () => {
  it('lets the first two attempts go, then grows to an hour', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 40].map(waitAfter)).toEqual([
      0,
      0,
      0,
      30 * MS_PER_SECOND,
      MS_PER_MINUTE,
      5 * MS_PER_MINUTE,
      15 * MS_PER_MINUTE,
      MS_PER_HOUR,
      MS_PER_HOUR,
    ]);
  });

  it('never shrinks as failures add up', () => {
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 100 }), (failures) => {
        expect(waitAfter(failures + 1)).toBeGreaterThanOrEqual(waitAfter(failures));
        expect(waitAfter(failures)).toBeLessThanOrEqual(MS_PER_HOUR);
      }),
    );
  });
});

describe('recordFailure', () => {
  it('counts one more failure and starts its wait', () => {
    let attempts: Attempts = NO_ATTEMPTS;
    for (let i = 0; i < 3; i += 1) attempts = recordFailure(attempts);
    expect(attempts).toEqual({ failures: 3, waitMs: 30 * MS_PER_SECOND });
    expect(isWaiting(attempts)).toBe(true);
    expect(isWaiting(NO_ATTEMPTS)).toBe(false);
  });
});

describe('elapse', () => {
  it('only ever shortens the wait, and never below zero', () => {
    fc.assert(
      fc.property(
        attemptsArb,
        fc.integer({ min: -MS_PER_HOUR, max: 3 * MS_PER_HOUR }),
        (attempts, ms) => {
          const next = elapse(attempts, ms);
          expect(next.failures).toBe(attempts.failures);
          expect(next.waitMs).toBeLessThanOrEqual(attempts.waitMs);
          expect(next.waitMs).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  it('gives no credit for time going backwards', () => {
    expect(elapse({ failures: 4, waitMs: 1000 }, -5000)).toEqual({ failures: 4, waitMs: 1000 });
  });
});

describe('resumeAttempts', () => {
  it('counts the wall time since the wait was saved', () => {
    const saved = { attempts: { failures: 5, waitMs: 5 * MS_PER_MINUTE }, savedAt: 1_000_000 };
    expect(resumeAttempts(saved, 1_000_000 + 2 * MS_PER_MINUTE).waitMs).toBe(3 * MS_PER_MINUTE);
    expect(resumeAttempts(saved, 1_000_000 + MS_PER_HOUR).waitMs).toBe(0);
  });

  it('keeps the whole wait when the clock was moved back', () => {
    const saved = { attempts: { failures: 5, waitMs: 5 * MS_PER_MINUTE }, savedAt: 1_000_000 };
    expect(resumeAttempts(saved, 0)).toEqual(saved.attempts);
  });
});

describe('timeAway', () => {
  it('takes the longer gap, and never a negative one', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (mono, wall) => {
        const away = timeAway(mono, wall);
        expect(away).toBeGreaterThanOrEqual(0);
        expect(away).toBeGreaterThanOrEqual(mono);
        expect(away).toBeGreaterThanOrEqual(wall);
      }),
    );
  });
});

describe('shouldRelock', () => {
  it('locks once the time away reaches the delay', () => {
    const settings = { enabled: true, delay: 5 * MS_PER_MINUTE };
    expect(shouldRelock(settings, 5 * MS_PER_MINUTE - 1)).toBe(false);
    expect(shouldRelock(settings, 5 * MS_PER_MINUTE)).toBe(true);
    expect(shouldRelock({ enabled: true, delay: 0 }, 0)).toBe(true);
  });

  it('never locks when the lock is off', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LOCK_DELAYS), fc.nat(), (delay, away) => {
        expect(shouldRelock({ enabled: false, delay }, away)).toBe(false);
      }),
    );
  });
});

describe('lock settings', () => {
  it('starts off and asks again after a minute', () => {
    expect(DEFAULT_LOCK_SETTINGS).toEqual({ enabled: false, delay: MS_PER_MINUTE });
    expect(isLockDelay(DEFAULT_LOCK_SETTINGS.delay)).toBe(true);
    expect(isLockDelay(2 * MS_PER_MINUTE)).toBe(false);
  });
});
