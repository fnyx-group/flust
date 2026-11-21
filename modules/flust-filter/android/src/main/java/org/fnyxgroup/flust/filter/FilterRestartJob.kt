package org.fnyxgroup.flust.filter

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.net.VpnService
import android.os.PersistableBundle

// Brings the filter back after Android or the manufacturer killed flust. Jobs survive a kill,
// not a force stop. A one-off job runs a few seconds after the task is removed, and a periodic one
// is the safety net for kills nothing announces.
class FilterRestartJob : JobService() {
  override fun onStartJob(params: JobParameters): Boolean {
    val trigger = params.extras.getString(EXTRA_TRIGGER) ?: TRIGGER_PERIODIC
    FilterTestLog.event("job ran, trigger=$trigger")
    restartIfNeeded(this, "job-$trigger")
    return false
  }

  override fun onStopJob(params: JobParameters): Boolean = false

  companion object {
    private const val SOON_JOB = 0x464c01
    private const val PERIODIC_JOB = 0x464c02
    private const val EXTRA_TRIGGER = "trigger"
    private const val TRIGGER_PERIODIC = "periodic"
    private const val SOON_DELAY_MILLIS = 3_000L
    private const val SOON_DEADLINE_MILLIS = 15_000L
    private const val PERIOD_MILLIS = 15 * 60 * 1_000L

    fun scheduleSoon(context: Context, trigger: String) {
      val job = JobInfo.Builder(SOON_JOB, ComponentName(context, FilterRestartJob::class.java))
        .setMinimumLatency(SOON_DELAY_MILLIS)
        .setOverrideDeadline(SOON_DEADLINE_MILLIS)
        .setExtras(PersistableBundle().apply { putString(EXTRA_TRIGGER, trigger) })
        .build()
      schedule(context, job, "soon, trigger=$trigger")
    }

    // Kept when already pending, so that each start of the tunnel does not push the next run back.
    fun schedulePeriodic(context: Context) {
      val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
      if (scheduler.getPendingJob(PERIODIC_JOB) != null) return
      val job = JobInfo.Builder(PERIODIC_JOB, ComponentName(context, FilterRestartJob::class.java))
        .setPeriodic(PERIOD_MILLIS)
        .setPersisted(true)
        .build()
      schedule(context, job, "periodic")
    }

    fun cancel(context: Context) {
      val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
      scheduler.cancel(SOON_JOB)
      scheduler.cancel(PERIODIC_JOB)
      FilterTestLog.event("jobs cancelled")
    }

    fun restartIfNeeded(context: Context, trigger: String) {
      val skipped = when {
        !FilterConfigStore(context).load().enabled -> "filter off"
        VpnService.prepare(context) != null -> "no consent"
        FilterStatus.running -> "already running"
        else -> null
      }
      if (skipped != null) return FilterTestLog.event("restart skipped, $skipped, trigger=$trigger")
      try {
        FilterVpnService.start(context, trigger)
        FilterTestLog.event("restart attempted, accepted, trigger=$trigger")
      } catch (refused: Exception) {
        FilterTestLog.event("restart attempted, refused ${refused.javaClass.name}, trigger=$trigger")
      }
    }

    private fun schedule(context: Context, job: JobInfo, label: String) {
      val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
      val result = try {
        if (scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS) "ok" else "failed"
      } catch (refused: Exception) {
        "refused ${refused.javaClass.name}"
      }
      FilterTestLog.event("job scheduled, $label, $result")
    }
  }
}
