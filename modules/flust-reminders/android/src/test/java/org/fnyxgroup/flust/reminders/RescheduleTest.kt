package org.fnyxgroup.flust.reminders

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.TimeZone

class RescheduleTest {
  private val paris = offsetsOf(TimeZone.getTimeZone("Europe/Paris"))
  private val newYork = offsetsOf(TimeZone.getTimeZone("America/New_York"))
  private val utcZone: OffsetAt = { 0 }

  private fun at(year: Int, month: Int, day: Int, hour: Int, minute: Int = 0): Long =
    WallTime(year, month, day, hour, minute).toInstant(utcZone)

  private fun reminder(id: Int, wall: WallTime, floating: Boolean = true, offsets: OffsetAt = paris) =
    Reminder(id, "body", "/check-in", wall, floating, wall.toInstant(offsets))

  @Test
  fun keepsTheWallTimeOfFloatingRemindersAfterATimeZoneChange() {
    val evening = reminder(1, WallTime(2026, 11, 16, 21, 0))
    val now = at(2026, 11, 15, 12)

    val inNewYork = upcoming(listOf(evening), now, newYork)

    assertEquals(listOf(evening to at(2026, 11, 17, 2)), inNewYork)
  }

  @Test
  fun keepsTheInstantOfFixedReminders() {
    val rank = reminder(2, WallTime(2026, 11, 16, 9, 0), floating = false)
    val now = at(2026, 11, 15, 12)

    assertEquals(listOf(rank to rank.at), upcoming(listOf(rank), now, newYork))
  }

  @Test
  fun dropsRemindersThatPassedWhileThePhoneWasOff() {
    val missed = reminder(1, WallTime(2026, 11, 15, 8, 0))
    val next = reminder(2, WallTime(2026, 11, 16, 8, 0))
    val now = at(2026, 11, 15, 12)

    assertEquals(listOf(2), upcoming(listOf(next, missed), now, paris).map { it.first.id })
  }

  @Test
  fun ordersRemindersByWhenTheyFire() {
    val later = reminder(1, WallTime(2026, 11, 18, 8, 0))
    val sooner = reminder(2, WallTime(2026, 11, 16, 21, 0))
    val now = at(2026, 11, 15, 12)

    assertEquals(listOf(2, 1), upcoming(listOf(later, sooner), now, paris).map { it.first.id })
  }

  @Test
  fun followsADaylightSavingChangeForFloatingReminders() {
    val beforeChange = reminder(1, WallTime(2026, 10, 24, 21, 0))
    val afterChange = reminder(2, WallTime(2026, 10, 26, 21, 0))
    val now = at(2026, 10, 24, 12)

    val instants = upcoming(listOf(beforeChange, afterChange), now, paris).map { it.second }

    assertEquals(listOf(at(2026, 10, 24, 19), at(2026, 10, 26, 20)), instants)
  }

  @Test
  fun removesTheDeliveredReminderAndAnythingAlreadyPast() {
    val missed = reminder(1, WallTime(2026, 11, 15, 8, 0))
    val delivered = reminder(2, WallTime(2026, 11, 15, 21, 0))
    val next = reminder(3, WallTime(2026, 11, 16, 21, 0))
    val now = at(2026, 11, 15, 20, 1)

    assertEquals(listOf(next), afterDelivery(listOf(missed, delivered, next), 2, now, paris))
  }
}
