package org.fnyxgroup.flust.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.io.IOException
import java.util.TimeZone

// Alarms are cleared by a reboot and an app update, and set as instants, so a time zone or clock
// change would leave floating reminders at the old wall time.
class RescheduleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in ACTIONS) return
    try {
      ReminderScheduler(context).restore(zoneOf(intent))
    } catch (error: IOException) {
      // The alarms already set stay as they are, and the next open plans everything again.
    }
  }

  // The process default can still hold the previous zone when this runs, so the new one is read
  // from the broadcast.
  private fun zoneOf(intent: Intent): TimeZone {
    if (intent.action != Intent.ACTION_TIMEZONE_CHANGED) return TimeZone.getDefault()
    val id = intent.getStringExtra(Intent.EXTRA_TIMEZONE) ?: return TimeZone.getDefault()
    return TimeZone.getTimeZone(id)
  }

  companion object {
    private val ACTIONS = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_TIME_CHANGED,
    )
  }
}
