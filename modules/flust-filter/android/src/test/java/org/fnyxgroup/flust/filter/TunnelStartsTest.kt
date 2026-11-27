package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TunnelStartsTest {
  private val moderate = FilterConfig(enabled = true)
  private val strict = FilterConfig(enabled = true, youtube = YouTubeLevel.STRICT)

  @Test
  fun letsTheOnlyStartSetUpItsTunnel() {
    val starts = TunnelStarts()
    val ticket = starts.begin(moderate)

    assertEquals(moderate, starts.pending)
    assertTrue(starts.finish(ticket))
    assertNull(starts.pending)
  }

  @Test
  fun dropsAStartStoppedDuringItsPreparation() {
    val starts = TunnelStarts()
    val ticket = starts.begin(moderate)
    starts.cancel()

    assertFalse(starts.finish(ticket))
    assertNull(starts.pending)
  }

  @Test
  fun dropsAStartReplacedByNewerSettings() {
    val starts = TunnelStarts()
    val first = starts.begin(moderate)
    val second = starts.begin(strict)

    assertFalse(starts.finish(first))
    assertEquals(strict, starts.pending)
    assertTrue(starts.finish(second))
  }

  @Test
  fun neverLetsAStartFinishTwice() {
    val starts = TunnelStarts()
    val ticket = starts.begin(moderate)

    assertTrue(starts.finish(ticket))
    starts.cancel()
    assertFalse(starts.finish(ticket))
  }

  @Test
  fun skipsAStartForTheSettingsBeingPrepared() {
    val starts = TunnelStarts()
    starts.begin(strict)

    assertTrue(starts.covers(strict, running = moderate))
    assertFalse(starts.covers(moderate, running = moderate))
  }

  @Test
  fun skipsAStartForTheRunningSettingsWhenNothingIsPrepared() {
    val starts = TunnelStarts()

    assertTrue(starts.covers(moderate, running = moderate))
    assertFalse(starts.covers(strict, running = moderate))
    assertFalse(starts.covers(moderate, running = null))
  }

  // A change of language gives new notification words, which must not set up a new tunnel.
  @Test
  fun skipsAStartThatOnlyChangesTheNotificationWords() {
    val starts = TunnelStarts()
    val renamed = moderate.copy(notification = words("Service en arrière-plan", "Actif en arrière-plan"))

    assertTrue(starts.covers(renamed, running = moderate))
    starts.begin(moderate)
    assertTrue(starts.covers(renamed, running = null))
  }

  // A crash while the tunnel is set up must still find the start under way (CrashRestart).
  @Test
  fun keepsAFinishedStartUnderWayUntilItsTunnelIsSetUp() {
    val reported = mutableListOf<Boolean>()
    val starts = TunnelStarts { reported += it }
    val ticket = starts.begin(moderate)

    assertTrue(starts.finish(ticket))
    assertTrue(starts.underWay)
    starts.done()

    assertFalse(starts.underWay)
    assertEquals(listOf(true, false), reported)
  }

  @Test
  fun endsAStartThatWasCancelled() {
    val starts = TunnelStarts()
    starts.begin(moderate)
    starts.cancel()

    assertFalse(starts.underWay)
  }

  @Test
  fun keepsANewerStartUnderWayWhenAnOlderOneIsDropped() {
    val starts = TunnelStarts()
    val first = starts.begin(moderate)
    starts.begin(strict)

    assertFalse(starts.finish(first))
    starts.done()

    assertTrue(starts.underWay)
  }
}
