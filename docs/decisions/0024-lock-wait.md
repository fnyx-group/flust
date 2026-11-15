# 0024 Lock wait

## Context

The system prompt limits biometric attempts, but cancelling it costs nothing, so the lock screen could be retried without end. A wait between attempts slows that down. It must not punish a prompt closed by mistake or by the system.

## Decision

- Failed and cancelled attempts count. Interruptions by the system, such as a call, do not, nor does a system lockout, which already has its own wait.
- The first two attempts are free. Then the wait grows: 30 seconds, 1, 5 and 15 minutes, then 1 hour at most (`waitAfter`, `src/domain/lock.ts`).
- The wait counts down on the monotonic clock, so changing the time does not shorten it. It is stored every ten seconds, and at each attempt, with the wall time it was saved at.
- After a restart, the wall time since it was saved is taken off. A clock set back gives no credit.
- A successful unlock clears the attempts. A stored value that cannot be read counts as no attempts.

## Consequences

- A restart can lose up to ten seconds of wait. Moving the clock forward can shorten a wait across a restart, but needs the phone unlocked, which is already the passcode.
- The wait is shown in seconds under a minute, then in whole minutes, rounded up.
