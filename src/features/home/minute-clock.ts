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
