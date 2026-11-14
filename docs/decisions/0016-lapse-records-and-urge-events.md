# 0016 Lapse records and urge events

## Context

The lapse screen asks optional questions, where, when and in what context, and can adjust the if/then plan. A lapse logged by mistake must be undoable, with the previous streak, the answers and the plan restored exactly ([Relapse](../product/relapse.md)). Home shows a supportive line and holds rank unlocks for a few hours after a lapse, and offers the undo for the rest of the day, so the time a lapse was logged matters as much as the time it happened. The emergency screen records each visit for future statistics.

Lapses were stored as bare timestamps, and two lapses can share the same time, so a timestamp cannot identify a lapse. The journey was also saved by rewriting every lapse row, which gives the rows new ids.

## Decision

- Migration 3 adds `recorded_at` to `lapse`, a `lapse_detail` table and an `urge_event` table. Lapses stored before it have no `recorded_at`; they are never offered for undo and never start the hours that follow a lapse.
- A lapse is written and removed one row at a time, by id, in `src/data/lapse-repository.ts`. The journey repository no longer saves a whole journey, so ids stay stable and details never lose their lapse.
- `lapse_detail` holds the place, the context as risk moment ids, and the plan change as both plans. Skipping the questions stores no detail. A detail row is deleted explicitly with its lapse, in the same transaction, since foreign keys are off on this connection.
- Undoing a lapse runs one transaction: the previous plan comes back if the plan is still the one the lapse set, then the detail and the lapse are deleted. The session removes the same timestamp from the journey only once that transaction has committed. Streak, total and week strip are recomputed from timestamps. Ranks are not touched: logging a lapse never changes them.
- The undo is offered until the local midnight after the lapse was logged, and never less than an hour after it. The supportive line and the hold on rank unlocks last six hours after it was logged. A clock set back further than a window's length ends that window, so a lapse logged while the clock was far ahead never keeps it open for days.
- A lapse can be backdated within the current streak only: never before the last lapse or the start.
- An urge event is written when the emergency screen opens and completed with its end and outcome (held, lapse or closed) when the screen is removed. Only the first outcome counts. A visit cut short by the app being killed keeps no end and no outcome.

## Consequences

- An undo restores the exact state from before the lapse, including when another lapse has the same time.
- A plan edited after a lapse is the user's newer choice and survives an undo of that lapse.
- The last lapse logged, not the latest by time, is the one an undo is about, which suits a backdated lapse.
- Urge events and lapse details are ready for statistics and pattern detection without a further migration.
