package org.fnyxgroup.flust.reminders

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.TimeZone

class WallTimeTest {
  private val paris = offsetsOf(TimeZone.getTimeZone("Europe/Paris"))
  private val tokyo = offsetsOf(TimeZone.getTimeZone("Asia/Tokyo"))

  private fun utc(year: Int, month: Int, day: Int, hour: Int, minute: Int = 0): Long =
    WallTime(year, month, day, hour, minute).toInstant { 0 }

  @Test
  fun convertsAWallTimeWithTheZoneOffset() {
    assertEquals(utc(2026, 11, 15, 20), WallTime(2026, 11, 15, 21, 0).toInstant(paris))
    assertEquals(utc(2026, 7, 15, 19), WallTime(2026, 7, 15, 21, 0).toInstant(paris))
  }

  @Test
  fun movesASkippedWallTimeForwardByTheGap() {
    // Paris springs forward on 29 March 2026, from 02:00 to 03:00 local time.
    assertEquals(utc(2026, 3, 29, 1, 30), WallTime(2026, 3, 29, 2, 30).toInstant(paris))
  }

  @Test
  fun resolvesARepeatedWallTimeToItsFirstOccurrence() {
    // Paris falls back on 25 October 2026: 02:30 happens at 00:30 and 01:30 UTC.
    assertEquals(utc(2026, 10, 25, 0, 30), WallTime(2026, 10, 25, 2, 30).toInstant(paris))
  }

  @Test
  fun keepsTheWallTimeInANewZone() {
    val wall = WallTime(2026, 11, 15, 21, 0)
    assertEquals(utc(2026, 11, 15, 12), wall.toInstant(tokyo))
    assertEquals(utc(2026, 11, 15, 20), wall.toInstant(paris))
  }

  @Test
  fun handlesOffsetsThatAreNotWholeHours() {
    val kolkata = offsetsOf(TimeZone.getTimeZone("Asia/Kolkata"))
    assertEquals(utc(2026, 11, 15, 15, 30), WallTime(2026, 11, 15, 21, 0).toInstant(kolkata))
  }
}
