# 0018 Daily check-in

## Context

The daily check-in records mood, urge level, context and an optional note ([Features](../product/features.md#daily-check-in)). There is one per day, editable until local midnight, and it must stay on its day when the user travels. Several low mood check-ins in a row should lead to a calm suggestion to talk to someone ([Relapse](../product/relapse.md#special-cases)). Timestamps alone cannot say which day a check-in belongs to: the same instant falls on different local days in different time zones.

## Decision

- Migration 4 adds a `check_in` table: `local_day`, unique, `recorded_at`, `updated_at`, `mood` (1 to 5), `urge_level` (`none`, `light`, `strong`, `intense`), `context` as a JSON array of risk moment ids, like `lapse_detail`, and an optional `note`.
- `local_day` is the local day number (`localDayNumber`) when the user taps "Save", computed once and stored. It is never recomputed from `recorded_at`, so a time zone change never moves a check-in to another day.
- Saving again on the same local day updates the row: `recorded_at` stays, `updated_at` moves. A screen left open past midnight saves to the new day and leaves the previous one as it was. A clock set back to an earlier day edits that day's check-in.
- Rows are validated through `parseCheckIn` in `src/domain/check-in.ts` when read. A row that fails is left out. A save whose row cannot be read back is rolled back.
- Mood and urge level have no default, so the app never suggests an answer: "Save" stays disabled until both are chosen.
- The low mood card shows when the three most recent check-ins of the last 14 local days, today included, all have a mood of 1 or 2. Missed days do not break the run. Check-ins older than the window no longer count, so a hard week long past does not bring the card back every day. Days after today, left by a clock set back, are ignored.
- Closing the card stores the local day in the `setting` table. The card stays hidden until the next local day. A dismissal that cannot be read shows the card again; one that cannot be written still hides it until the app restarts.
- The session loads the check-ins of the low mood window at launch and adds those saved later. The window only moves forward, so nothing it needs is missing.

## Consequences

- A check-in saved late in the evening before a flight east stays on the day it was written.
- The check-in never reads lapses, so it cannot mention one.
- Statistics and pattern detection can read check-ins without a further migration. The UTC offset at the time of saving is not stored, so the local hour of a check-in is not known.
- The card names no country-specific number until the help page brings numbers by country.
