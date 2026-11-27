package org.fnyxgroup.flust.filter

// What flust does as its process dies of an uncaught exception, when the crash takes a running
// tunnel or a start under way with it: ask for the one-off restart job a second later, or a
// minute later after a crash within the last minute, so a filter that keeps crashing, at start
// or once running, restarts once a minute at most. Without a tunnel or a start, there is nothing
// to bring back. Times are on the elapsed clock since boot; a time from before a reboot is larger
// than `now`.
enum class CrashRestartDecision(val event: String, val delayMillis: Long?) {
  SOON("restart in a second", 1_000L),
  LATER("restart in a minute, crashed again within a minute", 60_000L),
  INACTIVE("skipped, no tunnel or start", null);

  companion object {
    const val WINDOW_MILLIS = 60_000L

    fun of(active: Boolean, lastScheduled: Long?, now: Long): CrashRestartDecision = when {
      !active -> INACTIVE
      lastScheduled != null && lastScheduled <= now && now - lastScheduled < WINDOW_MILLIS -> LATER
      else -> SOON
    }

    // Records the time of the restart before asking for it, so the next crash sees it.
    fun handle(
      active: Boolean,
      lastScheduled: Long?,
      now: Long,
      record: (Long) -> Unit,
      schedule: (Long) -> Unit,
    ): CrashRestartDecision {
      val decision = of(active, lastScheduled, now)
      val delay = decision.delayMillis ?: return decision
      record(now)
      schedule(delay)
      return decision
    }
  }
}
