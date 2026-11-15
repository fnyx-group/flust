package org.fnyxgroup.flust.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.io.IOException

class ReminderAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getIntExtra(ReminderScheduler.EXTRA_ID, -1)
    if (id < 0) return
    val scheduler = ReminderScheduler(context)
    // A list that cannot be written is left as it is: an exception here would crash the app in
    // the background, and the next open plans everything again.
    val reminder = try {
      scheduler.takeDelivered(id)
    } catch (error: IOException) {
      null
    } ?: return
    val notifier = ReminderNotifier(context)
    val (name, description) = scheduler.channel()
    notifier.ensureChannel(name, description)
    notifier.post(reminder)
  }
}
