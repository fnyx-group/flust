package org.fnyxgroup.flust.clock

import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// elapsedRealtime keeps counting while the phone sleeps, unlike the clock behind
// performance.now(), and changing the date and time does not move it.
class FlustClockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlustClock")

    Function("elapsedMs") { SystemClock.elapsedRealtime().toDouble() }
  }
}
