package org.fnyxgroup.flust.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.AlarmManagerCompat
import java.util.TimeZone

// Alarms are inexact on purpose: exact alarms need a permission Play restricts to alarm and
// calendar apps, and a reminder a few minutes late is fine.
class ReminderScheduler(private val context: Context) {
  private val store = ReminderStore(context)
  private val alarms = context.getSystemService(AlarmManager::class.java)

  // The new list is stored before any alarm changes, so a failed write leaves the previous plan
  // whole, alarms included.
  fun replace(reminders: List<Reminder>) = synchronized(ReminderStore.LOCK) {
    val previous = store.read()
    store.write(previous.copy(reminders = reminders))
    previous.reminders.forEach { cancel(it.id) }
    schedule(reminders)
  }

  // After a reboot, an update, or a time zone or clock change: floating reminders are converted
  // again with the zone in effect and everything is set again. Reminders already past are dropped.
  fun restore(zone: TimeZone = TimeZone.getDefault()) = synchronized(ReminderStore.LOCK) {
    val contents = store.read()
    val kept = upcoming(contents.reminders, System.currentTimeMillis(), offsetsOf(zone))
    store.write(contents.copy(reminders = kept.map { it.first }))
    contents.reminders.forEach { cancel(it.id) }
    kept.forEach { (reminder, instant) -> set(reminder.id, instant) }
  }

  fun setChannel(name: String, description: String) = synchronized(ReminderStore.LOCK) {
    store.write(store.read().copy(channelName = name, channelDescription = description))
  }

  fun channel(): Pair<String, String> = store.read().let { it.channelName to it.channelDescription }

  // Null when the reminder is no longer planned, such as after a new plan replaced it.
  fun takeDelivered(id: Int): Reminder? = synchronized(ReminderStore.LOCK) {
    val contents = store.read()
    val reminder = contents.reminders.find { it.id == id } ?: return null
    val rest = afterDelivery(contents.reminders, id, System.currentTimeMillis(), currentOffsets())
    store.write(contents.copy(reminders = rest))
    reminder
  }

  private fun schedule(reminders: List<Reminder>) {
    upcoming(reminders, System.currentTimeMillis(), currentOffsets()).forEach { (reminder, instant) ->
      set(reminder.id, instant)
    }
  }

  private fun set(id: Int, instant: Long) {
    AlarmManagerCompat.setAndAllowWhileIdle(alarms, AlarmManager.RTC_WAKEUP, instant, pendingIntent(id))
  }

  private fun cancel(id: Int) {
    alarms.cancel(pendingIntent(id))
  }

  private fun pendingIntent(id: Int): PendingIntent {
    val intent = Intent(context, ReminderAlarmReceiver::class.java).putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(
      context,
      id,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  companion object {
    const val EXTRA_ID = "org.fnyxgroup.flust.reminders.ID"

    fun currentOffsets(): OffsetAt = offsetsOf(TimeZone.getDefault())
  }
}
