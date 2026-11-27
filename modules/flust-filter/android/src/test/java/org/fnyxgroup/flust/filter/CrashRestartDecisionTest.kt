package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Test

class CrashRestartDecisionTest {
  @Test
  fun schedulesARestartWhenTheCrashTakesARunningTunnel() {
    assertEquals(CrashRestartDecision.SOON, CrashRestartDecision.of(running = true, lastScheduled = null, now = 5_000))
  }

  @Test
  fun hasNothingToBringBackWithoutATunnel() {
    assertEquals(CrashRestartDecision.NOT_RUNNING, CrashRestartDecision.of(running = false, lastScheduled = null, now = 5_000))
  }

  // The restarted process could crash again at once.
  @Test
  fun waitsAMinuteAfterASecondCrashWithinAMinute() {
    assertEquals(CrashRestartDecision.LATER, CrashRestartDecision.of(running = true, lastScheduled = 10_000, now = 69_999))
  }

  @Test
  fun schedulesAgainOnceTheMinuteHasPassed() {
    assertEquals(CrashRestartDecision.SOON, CrashRestartDecision.of(running = true, lastScheduled = 10_000, now = 70_000))
  }

  // The elapsed clock starts again at boot.
  @Test
  fun ignoresATimeFromBeforeAReboot() {
    assertEquals(CrashRestartDecision.SOON, CrashRestartDecision.of(running = true, lastScheduled = 900_000, now = 4_000))
  }
}
