package org.fnyxgroup.flust.filter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

// The notification of the foreground service. Low importance and silent, hidden on the lock
// screen, and worded so that it does not say what flust is for. flust never asks for the
// notification permission for it: without the permission, or with its channel turned off, the
// service stays in the foreground and nothing shows (docs/decisions/0047-filter-foreground-service.md).
object FilterNotification {
  const val ID = 0x464c
  private const val CHANNEL_ID = "background-service"

  // The accent of the design system, #7B6BFF.
  private const val ACCENT = 0xFF7B6BFF.toInt()

  fun build(context: Context, text: NotificationText?): Notification {
    val words = text ?: NotificationText.DEFAULT
    ensureChannel(context, words.channelName)
    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.flust_filter_icon)
      .setColor(ACCENT)
      .setContentText(words.text)
      .setVisibility(NotificationCompat.VISIBILITY_SECRET)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setOngoing(true)
      .setSilent(true)
      .setShowWhen(false)
      .setContentIntent(launchIntent(context))
      .build()
  }

  // Applies new words to the channel, and to the notification while the service shows it.
  fun update(context: Context, text: NotificationText, running: Boolean) {
    ensureChannel(context, text.channelName)
    if (!running) return
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    try {
      manager.notify(ID, build(context, text))
    } catch (revoked: SecurityException) {
      // The permission went away between the check and the post: nothing to show.
    }
  }

  // Creating a channel that exists only renames it: the importance and the lock screen setting
  // stay as the person left them.
  private fun ensureChannel(context: Context, name: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW)
    channel.lockscreenVisibility = Notification.VISIBILITY_SECRET
    channel.setShowBadge(false)
    channel.setSound(null, null)
    channel.enableVibration(false)
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun launchIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(context, ID, launch, PendingIntent.FLAG_IMMUTABLE)
  }
}
