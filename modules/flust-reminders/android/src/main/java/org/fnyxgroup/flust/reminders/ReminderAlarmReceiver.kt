package org.fnyxgroup.flust.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getIntExtra(ReminderScheduler.EXTRA_ID, -1)
    if (id < 0) return
    val scheduler = ReminderScheduler(context)
    val reminder = scheduler.takeDelivered(id) ?: return
    val notifier = ReminderNotifier(context)
    val (name, description) = scheduler.channel()
    notifier.ensureChannel(name, description)
    notifier.post(reminder)
  }
}
