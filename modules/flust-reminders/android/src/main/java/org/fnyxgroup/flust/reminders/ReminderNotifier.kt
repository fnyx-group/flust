package org.fnyxgroup.flust.reminders

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

// One neutral channel. On a secure lock screen, notifications show the app name and hide their
// text. There is no title: the system shows the app name, and the body is neutral wording.
class ReminderNotifier(private val context: Context) {
  private val manager = NotificationManagerCompat.from(context)

  fun ensureChannel(name: String, description: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_DEFAULT)
    channel.description = description
    channel.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
    channel.setShowBadge(false)
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  fun canPost(): Boolean {
    if (!manager.areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
    val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL_ID)
    return channel == null || channel.importance != NotificationManager.IMPORTANCE_NONE
  }

  fun post(reminder: Reminder) {
    if (!canPost()) return
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.flust_reminder_icon)
      .setColor(ACCENT)
      .setContentText(reminder.body)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setAutoCancel(true)
      .setContentIntent(tapIntent(reminder))
      .build()
    try {
      manager.notify(TAG, reminder.id, notification)
    } catch (error: SecurityException) {
      // The permission was revoked between the check and the post: nothing to show.
    }
  }

  fun clearDelivered() {
    manager.cancelAll()
  }

  private fun tapIntent(reminder: Reminder): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.putExtra(EXTRA_ROUTE, reminder.route)
    launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    return PendingIntent.getActivity(
      context,
      reminder.id,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  companion object {
    const val CHANNEL_ID = "reminders"
    const val EXTRA_ROUTE = "org.fnyxgroup.flust.reminders.ROUTE"
    private const val TAG = "flust-reminder"

    // The accent of the design system, #7B6BFF.
    private const val ACCENT = 0xFF7B6BFF.toInt()
  }
}
