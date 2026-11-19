import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { MS_PER_SECOND } from '@/domain/time';
import { createElapsedClock } from '@/features/clock/elapsed-clock';
import { continuousClockDeps } from '@/features/clock/continuous-clock';

const SAVE_EVERY_MS = 10 * MS_PER_SECOND;

const NO_CLOCK = {
  subscribe: () => () => undefined,
  now: () => 0,
};

// A wait to count down. Each new object starts a new count, even when it lasts as long as the
// last one, so callers keep it stable while the same wait runs.
export type Wait = { readonly ms: number };

type CountdownHandlers = {
  // Stores the time left, so a restart resumes close to where it was.
  save(remainingMs: number): void;
  onEnd(): void;
};

// The time left of a wait, counted on a clock that keeps running while the phone sleeps, so
// changing the phone's time does not shorten it, in the foreground or away. It is saved every ten
// seconds while it runs. Used by the lock wait (docs/decisions/0024-lock-wait.md) and the filter
// delay (docs/decisions/0040-filter-delay.md).
export function useCountdown(wait: Wait | null, { save, onEnd }: CountdownHandlers): number {
  const durationMs = wait?.ms ?? 0;
  const clock = useMemo(
    () => (wait !== null && wait.ms > 0 ? createElapsedClock(continuousClockDeps) : NO_CLOCK),
    [wait],
  );
  const elapsed = useSyncExternalStore(clock.subscribe, clock.now);
  const remaining = Math.max(0, durationMs - elapsed);
  const savedBucket = useRef(Math.ceil(durationMs / SAVE_EVERY_MS));

  useEffect(() => {
    if (durationMs === 0) return;
    if (remaining === 0) {
      onEnd();
      return;
    }
    const bucket = Math.ceil(remaining / SAVE_EVERY_MS);
    if (bucket !== savedBucket.current) {
      savedBucket.current = bucket;
      save(remaining);
    }
  }, [durationMs, remaining, save, onEnd]);

  return remaining;
}
