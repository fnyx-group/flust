package org.fnyxgroup.flust.filter

import android.content.Context
import android.os.SystemClock
import java.util.concurrent.atomic.AtomicBoolean

// The filter runs in the app's process, so a crash of the interface ends it too, and Android does
// not always restart a service whose process crashed. Before the process dies, this asks for the
// one-off restart job, which survives the crash (docs/decisions/0049-filter-restart-after-crash.md).
// The previous handler then ends the process as it would have (CrashHandler).
object CrashRestart {
  private const val PREFERENCES = "flust-filter-crash"
  private const val LAST_SCHEDULED = "last-scheduled"
  private val installed = AtomicBoolean(false)

  fun install(context: Context) {
    if (!installed.compareAndSet(false, true)) return
    val app = context.applicationContext
    Thread.setDefaultUncaughtExceptionHandler(CrashHandler(Thread.getDefaultUncaughtExceptionHandler()) { onCrash(app) })
  }

  private fun onCrash(context: Context) {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val last = if (preferences.contains(LAST_SCHEDULED)) preferences.getLong(LAST_SCHEDULED, 0) else null
    val decision = CrashRestartDecision.handle(
      active = FilterStatus.running || FilterStatus.starting,
      lastScheduled = last,
      now = SystemClock.elapsedRealtime(),
      // Written at once: the process is about to end.
      record = { now -> preferences.edit().putLong(LAST_SCHEDULED, now).commit() },
      schedule = { delay -> FilterRestartJob.scheduleSoon(context, "crash", delay) },
    )
    FilterLog.restart(context, "crash ${decision.event}")
  }
}
