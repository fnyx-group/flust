import { continuousClockDeps } from '@/features/clock/continuous-clock';

// Time away is read on the clock that keeps running while the phone sleeps, like the lock wait
// (docs/decisions/0024-lock-wait.md). performance.now() stops during sleep, and moving the date
// back meanwhile would then hide the time away, so the app would open without asking.
export const lockClockDeps = continuousClockDeps;
