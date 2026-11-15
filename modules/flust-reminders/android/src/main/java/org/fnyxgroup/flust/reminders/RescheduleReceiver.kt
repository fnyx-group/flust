package org.fnyxgroup.flust.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Alarms are cleared by a reboot and an app update, and set as instants, so a time zone or clock
// change would leave floating reminders at the old wall time.
class RescheduleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in ACTIONS) return
    ReminderScheduler(context).restore()
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
