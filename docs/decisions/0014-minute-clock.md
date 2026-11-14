# 0014 Minute clock

## Context

The home screen shows values that change with time: the streak counter, in hours and minutes during the first day, the rank badge's progress and the time left to the first rank, and a week strip and a quote that change at local midnight. They must stay correct after the app has been in the background, after the clock or the time zone changed, and without re-rendering the whole screen every minute.

## Decision

- Time-driven values are always recomputed from the stored timestamps and the current time, never accumulated from ticks ([0004 Relapse model](0004-relapse-model.md)).
- A single store, `createMinuteClock` in `src/features/clock/minute-clock.ts`, holds the current time. It ticks with one timer rescheduled after each tick, at the next whole minute counted from the streak start, so the counter changes exactly when a minute of the streak completes. A lapse moves the streak start and creates a new clock.
- Returning to the foreground reads the time again and reschedules at once, which covers clock and time zone changes made meanwhile. The timer stops in the background.
- Components subscribe through `useSyncExternalStore` with a selector and an optional equality check. Only the components that read the clock re-render, and only when their selected value changes: the counter re-renders when the minute or the day it shows changes, the rank badge once a day once a rank is reached, and the week strip and the quote once a day.
- The timer and the app state are passed in, so the clock is tested with fake ones.
- The same store ticks on another period with `createTickClock`. The emergency screen uses a one-second clock anchored at its opening time ([0016](0016-lapse-records-and-urge-events.md)).

## Consequences

- The screen around the time-driven components never re-renders on a tick.
- The quote and the week strip can change up to a minute after local midnight, since ticks follow the streak's minutes rather than the wall clock.
- Other screens that show elapsed time can reuse the clock with their own anchor. The ranks tab does, and Home's clock also drives the rank unlock check ([0015](0015-rank-unlock-announcement.md)).
