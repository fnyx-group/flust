import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import type { Attempts } from '@/domain/lock';
import { MS_PER_SECOND } from '@/domain/time';
import { createElapsedClock } from '@/features/clock/elapsed-clock';
import { continuousClockDeps } from '@/features/clock/continuous-clock';

const SAVE_EVERY_MS = 10 * MS_PER_SECOND;

const NO_CLOCK = {
  subscribe: () => () => undefined,
  now: () => 0,
};

type Countdown = {
  // Stores the wait left, so a restart resumes close to where it was.
  save(attempts: Attempts): void;
  onEnd(): void;
};

// The wait left, counted on a clock that keeps running while the phone sleeps, so changing the
// phone's time does not shorten it, in the foreground or away.
// It is saved every ten seconds while it runs.
export function useWaitCountdown(attempts: Attempts, { save, onEnd }: Countdown): number {
  const clock = useMemo(
    () => (attempts.waitMs > 0 ? createElapsedClock(continuousClockDeps) : NO_CLOCK),
    [attempts.waitMs],
  );
  const elapsed = useSyncExternalStore(clock.subscribe, clock.now);
  const remaining = Math.max(0, attempts.waitMs - elapsed);
  const savedBucket = useRef(Math.ceil(attempts.waitMs / SAVE_EVERY_MS));

  useEffect(() => {
    if (attempts.waitMs === 0) return;
    if (remaining === 0) {
      onEnd();
      return;
    }
    const bucket = Math.ceil(remaining / SAVE_EVERY_MS);
    if (bucket !== savedBucket.current) {
      savedBucket.current = bucket;
      save({ ...attempts, waitMs: remaining });
    }
  }, [attempts, remaining, save, onEnd]);

  return remaining;
}
