# 0013 Local time to UTC

## Context

The user can start their journey at a past date and time, chosen in an in-app picker as a wall clock time: a day, an hour and a minute in the current time zone. Timestamps are stored in UTC ([Scenarios](../product/scenarios.md#time)). Around a daylight saving change some wall times happen twice and some never happen, and time zones have offsets that are not whole hours.

## Decision

- One pure function, `localToUtc` in `src/domain/local-time.ts`, converts a wall time to UTC. It takes the time zone as a function returning the UTC offset at an instant, so the domain never reads the device time zone and tests run against real zone rules from Node's ICU data.
- A repeated wall time resolves to its first occurrence. A skipped wall time moves forward by the length of the gap: 02:30 in a 02:00 to 03:00 gap becomes 03:30. This matches the `compatible` disambiguation of the JavaScript Temporal proposal.
- On the device, the offset comes from `Date.prototype.getTimezoneOffset`, which follows the platform's time zone rules for any date.
- The picker is written in JavaScript, with no native module. Its days and steps are bounded by now and about ten years back. Hour and minute steps move along real time rather than the wall clock, so a clock change never leaves a step stuck.

## Consequences

- The second occurrence of a repeated hour cannot be picked from the calendar, only reached with the hour stepper. A start point is never that precise in practice.
- Dates are formatted from local fields as if they were UTC, so the device time zone never shifts them twice.
- The conversion assumes at most one offset change within two days, which holds for every real time zone.
