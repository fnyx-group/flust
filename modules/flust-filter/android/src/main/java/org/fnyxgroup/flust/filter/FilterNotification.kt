package org.fnyxgroup.flust.filter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat

// The notification of the foreground service. Low importance and silent, hidden on the lock
// screen, and worded so that it does not say what flust is for.
object FilterNotification {
  const val ID = 0x464c
  private const val CHANNEL_ID = "background-service"

  // The accent of the design system, #7B6BFF.
  private const val ACCENT = 0xFF7B6BFF.toInt()

  fun build(context: Context): Notification {
    ensureChannel(context)
    return NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.flust_filter_icon)
      .setColor(ACCENT)
      .setContentText(context.getString(R.string.flust_filter_notification_text))
      .setVisibility(NotificationCompat.VISIBILITY_SECRET)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setOngoing(true)
      .setSilent(true)
      .setShowWhen(false)
      .setContentIntent(launchIntent(context))
      .build()
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.flust_filter_channel_name),
      NotificationManager.IMPORTANCE_LOW,
    )
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
