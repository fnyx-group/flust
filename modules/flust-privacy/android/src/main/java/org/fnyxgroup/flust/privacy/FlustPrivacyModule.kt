package org.fnyxgroup.flust.privacy

import android.app.Activity
import android.os.SystemClock
import android.provider.Settings
import android.view.WindowManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// FLAG_SECURE without expo-screen-capture, which registers a screenshot observer as it loads and
// crashes without DETECT_SCREEN_CAPTURE, a permission flust blocks since it detects nothing.
// ActivityPrivacy sets it as the activity is created; setSecure confirms it from JavaScript and
// reports a failure there.
class FlustPrivacyModule : Module() {
  // Applied again to each activity that comes to the foreground, so a recreated one is covered.
  // Null until setSecure is called, so a build that never calls it, such as the development
  // build, never touches the window from here.
  private var secure: Boolean? = null

  override fun definition() = ModuleDefinition {
    Name("FlustPrivacy")

    // elapsedRealtime keeps counting while the phone sleeps, unlike the clock behind
    // performance.now(), and changing the date and time does not move it.
    Function("elapsedMs") { SystemClock.elapsedRealtime().toDouble() }

    // elapsedRealtime starts again from zero at each boot. The boot count tells a wait saved with
    // it whether the phone restarted since. -1 when Android does not say.
    Function("bootCount") {
      val resolver = appContext.reactContext?.contentResolver ?: return@Function -1
      Settings.Global.getInt(resolver, Settings.Global.BOOT_COUNT, -1)
    }

    AsyncFunction("setSecure") { on: Boolean ->
      secure = on
      val activity = appContext.currentActivity ?: throw NoActivityException()
      apply(activity, on)
    }.runOnQueue(Queues.MAIN)

    // OnActivityEntersForeground can fire on the JS thread, and only the UI thread may touch the
    // window.
    OnActivityEntersForeground {
      val on = secure ?: return@OnActivityEntersForeground
      val activity = appContext.currentActivity ?: return@OnActivityEntersForeground
      activity.runOnUiThread { apply(activity, on) }
    }
  }

  private fun apply(activity: Activity, on: Boolean) {
    if (on) {
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    } else {
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }

  private class NoActivityException :
    CodedException("No activity to protect from screenshots")
}
