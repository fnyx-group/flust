# 0015 Rank unlock announcement

## Context

The rank unlock screen must appear when a rank is reached, whether the app was open or closed, and only once per rank ([Ranks](../product/ranks.md)). The rank shown elsewhere, on the home badge and the ranks tab, follows total clean days at once, before any rank is stored. The check runs on a clock, so it can fire several times for the same unlock before React commits the change, and the screen must not cover the emergency screen or appear in the middle of a navigation.

## Decision

- Home checks for unlocks with `pendingUnlock` on each tick of its minute clock ([0014](0014-minute-clock.md)), which also ticks when the app returns to the foreground, and when Home regains the focus. It only checks while Home is focused.
- A rank is stored when its unlock screen is opened. Unlocked and announced are therefore the same thing: a stored rank is never announced again.
- The session owns an announcer that records announced ranks in a set updated synchronously, before the session state and the storage write. A second check before React commits finds the ranks already announced and does nothing.
- A failed write is not retried. The ranks stay in the session for this run and are announced again on the next launch. No rank is lost, since the total still reaches them.
- The unlock screen receives the ranks and the total as route parameters and only displays them. Malformed parameters, such as from a deep link, redirect to Home.

## Consequences

- The unlock screen appears within the minute a rank is reached, since a clean day of the current streak always ends on a tick of the clock.
- A rank reached while another screen is open is announced when the user comes back to Home.
- A journey started in the past at the onboarding shows its unlock screen as soon as Home appears.
