package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CrashRestartDecisionTest {
  @Test
  fun schedulesARestartWhenTheCrashTakesARunningTunnelOrAStart() {
    assertEquals(CrashRestartDecision.SOON, CrashRestartDecision.of(active = true, lastScheduled = null, now = 5_000))
    assertEquals(1_000L, CrashRestartDecision.SOON.delayMillis)
  }

  @Test
  fun hasNothingToBringBackWithoutATunnelOrAStart() {
    assertEquals(CrashRestartDecision.INACTIVE, CrashRestartDecision.of(active = false, lastScheduled = null, now = 5_000))
    assertNull(CrashRestartDecision.INACTIVE.delayMillis)
  }

  // The restarted process could crash again at once, at start or once running.
  @Test
  fun waitsAMinuteAfterASecondCrashWithinAMinute() {
    assertEquals(CrashRestartDecision.LATER, CrashRestartDecision.of(active = true, lastScheduled = 10_000, now = 69_999))
    assertEquals(60_000L, CrashRestartDecision.LATER.delayMillis)
  }

  @Test
  fun schedulesAgainOnceTheMinuteHasPassed() {
    assertEquals(CrashRestartDecision.SOON, CrashRestartDecision.of(active = true, lastScheduled = 10_000, now = 70_000))
  }

  // The elapsed clock starts again at boot.
  @Test
  fun ignoresATimeFromBeforeAReboot() {
    assertEquals(CrashRestartDecision.SOON, CrashRestartDecision.of(active = true, lastScheduled = 900_000, now = 4_000))
  }

  @Test
  fun recordsTheTimeThenSchedulesWithTheDelayOfTheDecision() {
    val calls = mutableListOf<String>()

    val decision = CrashRestartDecision.handle(
      active = true,
      lastScheduled = 10_000,
      now = 30_000,
      record = { calls += "record $it" },
      schedule = { calls += "schedule $it" },
    )

    assertEquals(CrashRestartDecision.LATER, decision)
    assertEquals(listOf("record 30000", "schedule 60000"), calls)
  }

  @Test
  fun neitherRecordsNorSchedulesWithoutATunnelOrAStart() {
    val calls = mutableListOf<String>()

    val decision = CrashRestartDecision.handle(
      active = false,
      lastScheduled = null,
      now = 30_000,
      record = { calls += "record $it" },
      schedule = { calls += "schedule $it" },
    )

    assertEquals(CrashRestartDecision.INACTIVE, decision)
    assertEquals(emptyList<String>(), calls)
  }
}
