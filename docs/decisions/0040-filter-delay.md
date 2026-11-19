# 0040 Filter delay

## Context

The content filter must be hard to weaken in a weak moment and easy to strengthen ([0038](0038-content-filter.md)). Turning it off, or turning Strict YouTube off, needs a wait long enough for an urge to pass. That wait must survive what someone could do to shorten it: closing the app, changing the date and time, or restarting the phone. The lock wait of [0024](0024-lock-wait.md) already counts on a clock that runs during sleep, but its resume after a restart trusts the wall clock, so moving the date forward and restarting the app shortens it. That is acceptable for the lock, which already needs the phone unlocked, and not for the filter.

## Decision

- Turning the filter or Strict YouTube on is immediate. Turning either off creates a request that waits 20 minutes, then asks for confirmation, and expires if it is not confirmed within the next 10 minutes. The window counts from the end of the wait, not from when flust is opened.
- One request at a time, as one countdown over the wait and the window (`src/domain/filter-request.ts`). Asking to turn the filter off replaces a request about Strict YouTube with a new full wait. The Strict YouTube switch is disabled while a request waits, and the Filter switch while a request to turn it off waits.
- Cancelling is immediate. The filter keeps protecting until the request is confirmed. A request about something already off, such as a filter turned off in the system settings, is cleared.
- The request lives in the encrypted database (`filter-request` setting), with the time left, the wall time, the phone's elapsed time since boot (`SystemClock.elapsedRealtime`) and the boot count (`Settings.Global.BOOT_COUNT`, read through `modules/flust-privacy`).
- On reading it back, within the same boot only the elapsed clock counts, so the date and time settings and a restart of the app change nothing. After a reboot, only the time since boot counts: the time the phone was off is never credited. Where there is no boot count, as on iOS until lot 3, the wall clock counts and a clock set back gives nothing, as in [0024](0024-lock-wait.md).
- While the screen is open, the countdown runs on the continuous clock of [0024](0024-lock-wait.md) and is saved every ten seconds, through the same hook as the lock wait (`src/features/clock/use-countdown.ts`).
- The confirmation is a sheet, not the device authentication: the 20 minutes are the friction. Neither of its buttons is red, since turning the filter off can be undone at once.
- No notification when the wait ends.

## Consequences

- A reboot during the wait loses the time the phone was off and up to ten seconds before it, never more.
- Clear data in the Android settings removes the request together with everything else, and turning the VPN off in the system settings stops the filter at once. Both are known limits of the design, and flust shows the filter as inactive.
- Someone who leaves during the wait comes back to an expired request when more than 10 minutes passed after its end, and has to ask again.
- The lock wait keeps its rule. It could move to the boot count later.
