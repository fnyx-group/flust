# 0017 Emergency elapsed clock

## Context

The emergency screen shows a 20-minute countdown and a breathing guide. Both were computed from the wall clock and the time the screen opened. Setting the phone's time while the screen is open froze them, for as long as the clock was moved back, or skipped them to the end when it was moved forward. Someone going through an urge should never see the guide stop.

## Decision

- The emergency screen uses `createElapsedClock` in `src/features/clock/elapsed-clock.ts`: a tick clock whose time is the time elapsed since the screen opened, ticking on its whole seconds.
- In the foreground, the elapsed time follows a monotonic clock (`performance.now()`), which changing the phone's time never moves.
- The monotonic clock can stop while the phone sleeps. On the first reading after a return from the background, the elapsed time adds the wall clock's gap when it is longer than the monotonic one; a wall clock moved back meanwhile leaves the monotonic gap.
- The countdown and the breathing are computed from that elapsed time only. Home, the ranks and everything tied to the streak keep the wall clock ([0014](0014-minute-clock.md)), since the streak is anchored to stored timestamps.
- The monotonic clock is passed in with the timer and the app state, so the clock is tested with fake ones.

## Consequences

- Changing the phone's time while the screen is in the foreground neither freezes nor skips the countdown or the breathing.
- A phone call, or the app in the background with the phone asleep, still shows the right remaining time on return.
- A clock moved forward while the app is in the background cannot be told apart from time spent asleep, and is counted.
