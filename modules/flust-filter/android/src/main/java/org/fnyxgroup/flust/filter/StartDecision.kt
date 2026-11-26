package org.fnyxgroup.flust.filter

// What the VPN service does with a start that is not a stop (docs/decisions/0047).
enum class StartDecision(val stopReason: StopReason?, val cancelJobs: Boolean) {
  START(stopReason = null, cancelJobs = false),

  // The person turned the filter off in flust: nothing may bring it back.
  OFF(StopReason.STOPPED, cancelJobs = true),

  // Android refused the foreground to a start that required it. The service stops, with its
  // tunnel closed and the reason recorded, rather than run on until Android ends the app for the
  // unanswered start. The filter stays on in the settings, so the restart jobs stay too.
  NO_FOREGROUND(StopReason.FAILED, cancelJobs = false),

  // The settings could not be read: a running tunnel keeps the settings it runs with.
  KEEP(stopReason = null, cancelJobs = false),

  // The settings could not be read and no tunnel runs. Nothing says the filter is off, so the
  // restart jobs stay, and try again.
  UNREADABLE(StopReason.FAILED, cancelJobs = false);

  companion object {
    // `foregroundRequired`: the start came from startForegroundService, flust's own starts. The
    // sticky restart and the always-on setting use startService: refused the foreground, the
    // filter still runs in the background, as it did before the foreground service.
    fun of(
      promoted: Boolean,
      foregroundRequired: Boolean,
      read: ConfigRead,
      alwaysOn: Boolean,
      running: Boolean,
    ): StartDecision = when {
      !alwaysOn && !read.failed && !read.config.enabled -> OFF
      !promoted && foregroundRequired -> NO_FOREGROUND
      read.failed && running -> KEEP
      read.failed && !alwaysOn -> UNREADABLE
      else -> START
    }
  }
}
