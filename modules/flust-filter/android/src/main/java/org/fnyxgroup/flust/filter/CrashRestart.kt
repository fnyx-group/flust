package org.fnyxgroup.flust.filter

import android.content.Context
import android.os.SystemClock
import java.util.concurrent.atomic.AtomicBoolean

// The filter runs in the app's process, so a crash of the interface ends it too, and Android does
// not always restart a service whose process crashed. Before the process dies, this asks for the one-off
// restart job, which survives the crash (docs/decisions/0049-filter-restart-after-crash.md). The
// previous handler then ends the process as it would have.
object CrashRestart {
  private const val PREFERENCES = "flust-filter-crash"
  private const val LAST_SCHEDULED = "last-scheduled"
  private val installed = AtomicBoolean(false)

  fun install(context: Context) {
    if (!installed.compareAndSet(false, true)) return
    val app = context.applicationContext
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        onCrash(app)
      } catch (ignored: Throwable) {
        // Nothing may keep the previous handler from ending the process.
      }
      previous?.uncaughtException(thread, error)
    }
  }

  private fun onCrash(context: Context) {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val now = SystemClock.elapsedRealtime()
    val last = if (preferences.contains(LAST_SCHEDULED)) preferences.getLong(LAST_SCHEDULED, 0) else null
    val decision = CrashRestartDecision.of(FilterStatus.running, last, now)
    FilterLog.restart(context, "crash ${decision.event}")
    val delay = when (decision) {
      CrashRestartDecision.SOON -> FilterRestartJob.CRASH_DELAY_MILLIS
      CrashRestartDecision.LATER -> CrashRestartDecision.WINDOW_MILLIS
      CrashRestartDecision.NOT_RUNNING -> return
    }
    // Written at once: the process is about to end.
    preferences.edit().putLong(LAST_SCHEDULED, now).commit()
    FilterRestartJob.scheduleSoon(context, "crash", delay)
  }
}
