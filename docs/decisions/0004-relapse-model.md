# 0004 Relapse model

## Context

Most abstinence trackers reset everything after a lapse. The abstinence violation effect (Marlatt) shows that treating a lapse as total failure makes a full relapse more likely. flust needs a model that keeps the motivation of a streak without turning a single lapse into a spiral.

Three options were considered:

- A: a single streak that resets to zero after a lapse.
- B: total clean days only, with no streak.
- C: a current streak that restarts after a lapse, plus total clean days that are kept.

## Decision

Option C. The current streak restarts after a lapse and shows hours and minutes again. Total clean days are kept and drive the rank, which is never lowered (see [0005 Rank system](0005-rank-system.md)).

The lapse screen says "A lapse, not a reset", shows what is kept, and offers optional questions and a plan adjustment. The full behavior is described in [Relapse](../product/relapse.md).

## Consequences

- A lapse costs the streak, not the progress built before it.
- The app stores lapses as timestamped events, so streaks and totals can be recomputed and a lapse logged by mistake can be undone.
- The interface must avoid failure signals: no reset animation, no red color, no comparison with the record streak right after a lapse.
- Two numbers are shown instead of one, which needs a clear layout on the home screen.
