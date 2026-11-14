import { MS_PER_SECOND } from '@/domain/time';
import { createTickClock, type ClockDeps, type TickClock } from '@/features/clock/minute-clock';

export type ElapsedClockDeps = ClockDeps & {
  // Only moves forward, whatever is done to the phone's date and time.
  monotonicNow(): number;
};

// A clock whose `now()` is the time elapsed since it was created, ticking on its whole periods.
// In the foreground it follows the monotonic clock, so setting the phone's time neither freezes
// nor skips it. The monotonic clock can stop while the phone sleeps, so the first reading after a
// return from the background counts the wall clock's gap when it is longer; a wall clock moved
// back meanwhile leaves the monotonic gap.
export function createElapsedClock(
  deps: ElapsedClockDeps,
  periodMs: number = MS_PER_SECOND,
): TickClock {
  let elapsed = 0;
  let lastMonotonic = deps.monotonicNow();
  let lastWall = deps.now();
  let wasInBackground = false;
  let resumed = false;

  function read(): number {
    const monotonic = deps.monotonicNow();
    const wall = deps.now();
    const monotonicGap = Math.max(0, monotonic - lastMonotonic);
    elapsed += resumed ? Math.max(monotonicGap, wall - lastWall) : monotonicGap;
    resumed = false;
    lastMonotonic = monotonic;
    lastWall = wall;
    return elapsed;
  }

  return createTickClock(0, periodMs, {
    now: read,
    setTimer: deps.setTimer,
    watchActivity(listener) {
      return deps.watchActivity((activity) => {
        if (activity === 'background') wasInBackground = true;
        if (activity === 'foreground' && wasInBackground) {
          wasInBackground = false;
          resumed = true;
        }
        listener(activity);
      });
    },
  });
}
