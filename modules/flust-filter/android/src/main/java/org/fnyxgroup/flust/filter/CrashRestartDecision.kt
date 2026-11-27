package org.fnyxgroup.flust.filter

// What flust does as its process dies of an uncaught exception, when the crash takes a running
// tunnel with it: ask for the one-off restart job a second later, or a minute later after a crash
// within the last minute, so a filter that itself crashes at start retries once a minute at most.
// Times are on the elapsed clock since boot; a time from before a reboot is larger than `now`.
enum class CrashRestartDecision(val event: String) {
  SOON("restart in a second"),
  LATER("restart in a minute, crashed again within a minute"),
  NOT_RUNNING("skipped, no tunnel");

  companion object {
    const val WINDOW_MILLIS = 60_000L

    fun of(running: Boolean, lastScheduled: Long?, now: Long): CrashRestartDecision = when {
      !running -> NOT_RUNNING
      lastScheduled != null && lastScheduled <= now && now - lastScheduled < WINDOW_MILLIS -> LATER
      else -> SOON
    }
  }
}
