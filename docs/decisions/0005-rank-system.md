# 0005 Rank system

## Context

flust rewards progress with ranks. If ranks depended on the current streak, a lapse would remove them, which is the kind of failure signal the relapse model avoids (see [0004 Relapse model](0004-relapse-model.md)).

## Decision

The rank depends on total clean days, never on the current streak. There are twelve ranks in five circles, from Novice at 1 day to Free soul at 365 days. A rank, once unlocked, stays unlocked.

The full list, the emblems and the unlock rules are described in [Ranks](../product/ranks.md).

## Consequences

- A lapse never lowers the rank, so long-term progress stays visible.
- Rank unlocks are computed from stored timestamps, so ranks reached while the app is closed are detected on next launch and shown together.
- Rank logic is pure and testable, and is covered by property-based tests.
- Rank names exist in French and English and are part of the translated strings.
