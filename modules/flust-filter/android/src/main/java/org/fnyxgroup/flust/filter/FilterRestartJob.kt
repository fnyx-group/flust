package org.fnyxgroup.flust.filter

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.net.VpnService
import android.os.PersistableBundle

// Brings the filter back after Android or the manufacturer killed flust, as a safety net behind
// the foreground service (docs/decisions/0047-filter-foreground-service.md). Jobs survive a kill,
// not a force stop. A one-off job runs a few seconds after flust leaves recents, and a periodic
// one covers kills that nothing announces.
class FilterRestartJob : JobService() {
  override fun onStartJob(params: JobParameters): Boolean {
    val trigger = params.extras.getString(EXTRA_TRIGGER) ?: TRIGGER_PERIODIC
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
      schedule(context, job, "soon after $trigger")
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
    }

    private fun restartIfNeeded(context: Context, trigger: String) {
      val decision = RestartDecision.of(
        enabled = FilterConfigStore.of(context).load().enabled,
        consent = VpnService.prepare(context) == null,
        running = FilterStatus.running,
      )
      if (decision != RestartDecision.START) return FilterLog.restart(context, "$trigger ${decision.event}")
      try {
        FilterVpnService.start(context, trigger)
        FilterLog.restart(context, "$trigger start accepted")
      } catch (refused: Exception) {
        FilterLog.restart(context, "$trigger start refused", refused)
      }
    }

    private fun schedule(context: Context, job: JobInfo, label: String) {
      val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
      try {
        val scheduled = scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS
        FilterLog.restart(context, "job $label ${if (scheduled) "scheduled" else "not scheduled"}")
      } catch (refused: Exception) {
        FilterLog.restart(context, "job $label not scheduled", refused)
      }
    }
  }
}
