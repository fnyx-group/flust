package org.fnyxgroup.flust.filter

import android.content.Context

// Why the tunnel last stopped, for the app to show. No browsing data: one word.
enum class StopReason(val code: String) {
  STOPPED("stopped"),
  REVOKED("revoked"),
  NO_CONSENT("no-consent"),
  FAILED("failed"),
}

object FilterStatus {
  private const val PREFERENCES = "flust-filter-status"
  private const val STOP_REASON = "stop-reason"

  @Volatile var running = false

  fun recordStop(context: Context, reason: StopReason?) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
      .putString(STOP_REASON, reason?.code)
      .apply()
  }

  fun stopReason(context: Context): String? =
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(STOP_REASON, null)
}
