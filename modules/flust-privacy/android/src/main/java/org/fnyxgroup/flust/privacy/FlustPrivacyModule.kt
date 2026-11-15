package org.fnyxgroup.flust.privacy

import android.os.SystemClock
import android.view.WindowManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// FLAG_SECURE without expo-screen-capture, which registers a screenshot observer as it loads and
// crashes without DETECT_SCREEN_CAPTURE, a permission flust blocks since it detects nothing.
class FlustPrivacyModule : Module() {
  // Applied again to each activity that comes to the foreground, so a recreated one is covered.
  private var secure = false

  override fun definition() = ModuleDefinition {
    Name("FlustPrivacy")

    // elapsedRealtime keeps counting while the phone sleeps, unlike the clock behind
    // performance.now(), and changing the date and time does not move it.
    Function("elapsedMs") { SystemClock.elapsedRealtime().toDouble() }

    AsyncFunction("setSecure") { on: Boolean ->
      secure = on
      applySecure()
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground { applySecure() }
  }

  private fun applySecure() {
    val window = appContext.currentActivity?.window ?: return
    if (secure) {
      window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    } else {
      window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }
}
