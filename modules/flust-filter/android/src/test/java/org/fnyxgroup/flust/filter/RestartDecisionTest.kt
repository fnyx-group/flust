package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Test

class RestartDecisionTest {
  @Test
  fun startsAFilterLeftOnWithConsentAndNoTunnel() {
    assertEquals(RestartDecision.START, RestartDecision.of(enabled = true, consent = true, running = false))
  }

  @Test
  fun leavesAFilterTheyTurnedOffAlone() {
    assertEquals(RestartDecision.OFF, RestartDecision.of(enabled = false, consent = true, running = false))
  }

  // Without consent, a start would only fail: flust asks again when it opens.
  @Test
  fun waitsForTheAppWhenConsentIsGone() {
    assertEquals(RestartDecision.NO_CONSENT, RestartDecision.of(enabled = true, consent = false, running = false))
  }

  @Test
  fun leavesARunningTunnelAlone() {
    assertEquals(RestartDecision.RUNNING, RestartDecision.of(enabled = true, consent = true, running = true))
  }
}
