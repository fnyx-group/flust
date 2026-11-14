import { msUntilNextMinute, type Timestamp } from '@/domain/time';

export type AppActivity = 'foreground' | 'background';

export type ClockDeps = {
  now(): Timestamp;
  // Returns a function that cancels the timer.
  setTimer(callback: () => void, ms: number): () => void;
  // Returns a function that stops watching.
  watchActivity(listener: (activity: AppActivity) => void): () => void;
};

export type MinuteClock = {
  now(): Timestamp;
  subscribe(listener: () => void): () => void;
};

// A store for useSyncExternalStore. It ticks on the minutes of `anchor`, the streak start, so the
// counter changes exactly when a minute of the streak completes. Coming back to the foreground
// reads the time again at once, which also covers clock and time zone changes made meanwhile,
// and nothing runs while the app is in the background.
export function createMinuteClock(anchor: Timestamp, deps: ClockDeps): MinuteClock {
  const listeners = new Set<() => void>();
  let current = deps.now();
  let cancelTimer: (() => void) | null = null;
  let stopWatching: (() => void) | null = null;

  function stopTimer() {
    cancelTimer?.();
    cancelTimer = null;
  }

  function schedule() {
    stopTimer();
    cancelTimer = deps.setTimer(tick, msUntilNextMinute(deps.now(), anchor));
  }

  function tick() {
    current = deps.now();
    for (const listener of listeners) listener();
    schedule();
  }

  function start() {
    current = deps.now();
    schedule();
    stopWatching = deps.watchActivity((activity) => {
      if (activity === 'foreground') tick();
      else stopTimer();
    });
  }

  function stop() {
    stopTimer();
    stopWatching?.();
    stopWatching = null;
  }

  return {
    now: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
  };
}

export type ClockSelection<T> = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): T;
};

// useSyncExternalStore re-renders when the snapshot changes by Object.is. Returning the previous
// value when `isEqual` holds lets a selector build a new object on each tick and still re-render
// only when what it shows changes. The value is cached per instant, since React reads the
// snapshot several times for one render.
export function selectFromClock<T>(
  clock: MinuteClock,
  select: (now: Timestamp) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): ClockSelection<T> {
  let cached: { now: Timestamp; value: T } | null = null;
  return {
    subscribe: clock.subscribe,
    getSnapshot() {
      const now = clock.now();
      if (cached?.now === now) return cached.value;
      const value = select(now);
      cached = {
        now,
        value: cached !== null && isEqual(cached.value, value) ? cached.value : value,
      };
      return cached.value;
    },
  };
}

// Equal when both objects have the same keys with values equal by Object.is.
export function sameFields(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
  );
}
