package org.fnyxgroup.flust.filter

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log

// Why the tunnel stopped, and how it was restarted after flust was killed, in the development
// build only: plugins/with-android-filter.ts turns it on there and nowhere else. Only stop
// reasons, fixed event words and exception classes are written, never a message, which could
// hold a queried name or an address.
object FilterLog {
  private const val TAG = "FlustFilter"
  private const val META_DATA = "org.fnyxgroup.flust.filter.LOGS"

  @Volatile private var enabled: Boolean? = null

  fun stopped(context: Context, reason: StopReason?, error: Throwable? = null) {
    if (!enabled(context)) return
    val cause = error?.let { ", ${it.javaClass.name}" } ?: ""
    Log.w(TAG, "Tunnel stopped: ${reason?.code ?: "destroyed"}$cause")
  }

  fun restart(context: Context, event: String, error: Throwable? = null) {
    if (!enabled(context)) return
    val cause = error?.let { ", ${it.javaClass.name}" } ?: ""
    Log.i(TAG, "Restart: $event$cause")
  }

  private fun enabled(context: Context): Boolean = enabled ?: read(context).also { enabled = it }

  // A value that cannot be read keeps the log off.
  private fun read(context: Context): Boolean =
    try {
      context.packageManager
        .getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        .metaData?.getBoolean(META_DATA, false) ?: false
    } catch (missing: PackageManager.NameNotFoundException) {
      false
    }
}
