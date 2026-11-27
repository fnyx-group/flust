package org.fnyxgroup.flust.filter

import android.content.Context

// How long the last start of the tunnel took, for the measure of the development build. Lists and
// trust run off the main thread, establish on it; total counts from the request to the running
// tunnel.
data class TunnelStartTiming(
  val listsMillis: Double,
  val listsCached: Boolean,
  val trustMillis: Double,
  val establishMillis: Double,
  val totalMillis: Double,
)

// The status the app reads every two seconds while the filter screen is open. Kept in memory, so
// a read touches no storage: the service, the boot receiver and the module share one process.
object FilterStatus {
  private const val PREFERENCES = "flust-filter-status"
  private const val STOP_REASON = "stop-reason"

  @Volatile var running = false

  // Whether a start of the tunnel is under way (TunnelStarts), read by CrashRestart.
  @Volatile var starting = false

  @Volatile var lastStart: TunnelStartTiming? = null

  // The name of the resolver queries go to, for the measure of the development build.
  @Volatile var activeResolver: () -> String? = { null }

  // Whether the always-on VPN setting names flust. Only the running service can tell, from
  // Android 10: null otherwise.
  @Volatile var alwaysOn: () -> Boolean? = { null }

  @Volatile private var reason: String? = null
  @Volatile private var reasonLoaded = false

  fun recordStop(context: Context, reason: StopReason?) {
    this.reason = reason?.code
    reasonLoaded = true
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
      .putString(STOP_REASON, reason?.code)
      .apply()
  }

  fun stopReason(context: Context): String? {
    if (!reasonLoaded) {
      reason = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(STOP_REASON, null)
      reasonLoaded = true
    }
    return reason
  }
}
