package org.fnyxgroup.flust.reminders

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.interfaces.permissions.PermissionsResponse
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class ReminderRecord : Record {
  @Field val id: Int = 0
  @Field val body: String = ""
  @Field val route: String = ""
  @Field val year: Int = 1970
  @Field val month: Int = 1
  @Field val day: Int = 1
  @Field val hour: Int = 0
  @Field val minute: Int = 0
  @Field val floating: Boolean = true
  @Field val at: Double = 0.0

  fun toReminder() = Reminder(id, body, route, WallTime(year, month, day, hour, minute), floating, at.toLong())
}

class FlustRemindersModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.AppContextLost()

  override fun definition() = ModuleDefinition {
    Name("FlustReminders")

    Events(TAP_EVENT)

    AsyncFunction("getPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(permission(ReminderNotifier(context).canPost(), false))
        return@AsyncFunction
      }
      val permissions = appContext.permissions ?: return@AsyncFunction promise.resolve(permission(false, false))
      permissions.getPermissions({ result -> promise.resolve(fromResult(result)) }, NOTIFICATIONS)
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(permission(ReminderNotifier(context).canPost(), false))
        return@AsyncFunction
      }
      val permissions = appContext.permissions ?: return@AsyncFunction promise.resolve(permission(false, false))
      permissions.askForPermissions({ result -> promise.resolve(fromResult(result)) }, NOTIFICATIONS)
    }

    Function("setChannel") { name: String, description: String ->
      ReminderScheduler(context).setChannel(name, description)
      ReminderNotifier(context).ensureChannel(name, description)
    }

    AsyncFunction("replace") { reminders: List<ReminderRecord> ->
      ReminderScheduler(context).replace(reminders.map { it.toReminder() })
    }

    Function("clearDelivered") {
      ReminderNotifier(context).clearDelivered()
    }

    // The route of the notification that launched the app, once.
    Function("takeLaunchTap") {
      appContext.currentActivity?.intent?.let(::takeRoute)
    }

    OnNewIntent { intent ->
      takeRoute(intent)?.let { route -> sendEvent(TAP_EVENT, mapOf("route" to route)) }
    }
  }

  // Removed once read, so a recreated activity does not open the same screen again.
  private fun takeRoute(intent: Intent): String? {
    val route = intent.getStringExtra(ReminderNotifier.EXTRA_ROUTE) ?: return null
    intent.removeExtra(ReminderNotifier.EXTRA_ROUTE)
    return route
  }

  // A granted permission still delivers nothing if notifications are off in the settings.
  private fun fromResult(result: Map<String, PermissionsResponse>): Map<String, Boolean> {
    val response = result[NOTIFICATIONS]
    val granted = response?.status == PermissionsStatus.GRANTED && ReminderNotifier(context).canPost()
    return permission(granted, response?.canAskAgain ?: false)
  }

  private fun permission(granted: Boolean, canAskAgain: Boolean) =
    mapOf("granted" to granted, "canAskAgain" to (!granted && canAskAgain))

  companion object {
    private const val TAP_EVENT = "onTap"
    private const val NOTIFICATIONS = Manifest.permission.POST_NOTIFICATIONS
  }
}
