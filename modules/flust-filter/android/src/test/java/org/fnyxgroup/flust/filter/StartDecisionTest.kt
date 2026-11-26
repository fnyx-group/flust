package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StartDecisionTest {
  private val on = ConfigRead(FilterConfig(enabled = true), failed = false)
  private val off = ConfigRead(FilterConfig(enabled = false), failed = false)
  private val failed = ConfigRead(FilterConfig(), failed = true)

  private fun decide(
    read: ConfigRead = on,
    promoted: Boolean = true,
    foregroundRequired: Boolean = true,
    alwaysOn: Boolean = false,
    running: Boolean = false,
  ) = StartDecision.of(promoted, foregroundRequired, read, alwaysOn, running)

  @Test
  fun startsAFilterLeftOn() {
    assertEquals(StartDecision.START, decide())
    assertEquals(StartDecision.START, decide(running = true))
  }

  @Test
  fun stopsAFilterTurnedOffAndCancelsItsJobs() {
    assertEquals(StartDecision.OFF, decide(read = off))
    assertEquals(StartDecision.OFF, decide(read = off, promoted = false))
    assertTrue(StartDecision.OFF.cancelJobs)
  }

  // The settings still say on: cancelling the jobs would leave them on with no tunnel for good.
  @Test
  fun stopsWithAReasonAndKeepsTheJobsWhenTheForegroundIsRefused() {
    assertEquals(StartDecision.NO_FOREGROUND, decide(promoted = false))
    assertEquals(StartDecision.NO_FOREGROUND, decide(promoted = false, running = true))
    assertEquals(StopReason.FAILED, StartDecision.NO_FOREGROUND.stopReason)
    assertFalse(StartDecision.NO_FOREGROUND.cancelJobs)
  }

  // The sticky restart and always-on use startService, which needs no answer: the filter runs in
  // the background rather than not at all.
  @Test
  fun startsInTheBackgroundWhenTheStartDidNotRequireTheForeground() {
    assertEquals(StartDecision.START, decide(promoted = false, foregroundRequired = false))
    assertEquals(StartDecision.START, decide(read = off, promoted = false, foregroundRequired = false, alwaysOn = true))
  }

  @Test
  fun keepsARunningTunnelWhenTheSettingsCannotBeRead() {
    assertEquals(StartDecision.KEEP, decide(read = failed, running = true))
    assertEquals(StartDecision.KEEP, decide(read = failed, alwaysOn = true, foregroundRequired = false, running = true))
  }

  @Test
  fun stopsWithAReasonAndKeepsTheJobsWhenTheSettingsCannotBeReadAndNoTunnelRuns() {
    assertEquals(StartDecision.UNREADABLE, decide(read = failed))
    assertEquals(StopReason.FAILED, StartDecision.UNREADABLE.stopReason)
    assertFalse(StartDecision.UNREADABLE.cancelJobs)
  }

  @Test
  fun startsWhenAlwaysOnAsksEvenIfTheSettingsSayOffOrCannotBeRead() {
    assertEquals(StartDecision.START, decide(read = off, alwaysOn = true, foregroundRequired = false))
    assertEquals(StartDecision.START, decide(read = failed, alwaysOn = true, foregroundRequired = false))
  }

  @Test
  fun neverCancelsTheJobsUnlessTheFilterWasTurnedOff() {
    assertEquals(listOf(StartDecision.OFF), StartDecision.entries.filter { it.cancelJobs })
  }
}
