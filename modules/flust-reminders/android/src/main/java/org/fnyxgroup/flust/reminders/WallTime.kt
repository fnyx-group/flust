package org.fnyxgroup.flust.reminders

import java.util.Calendar
import java.util.TimeZone

// The UTC offset in minutes east of UTC at an instant, passed in so the conversion can be tested
// with fixed zones.
typealias OffsetAt = (Long) -> Int

private const val MS_PER_MINUTE = 60_000L
private const val MS_PER_DAY = 24 * 60 * MS_PER_MINUTE

// A wall clock date and time. Months and days start at 1.
data class WallTime(val year: Int, val month: Int, val day: Int, val hour: Int, val minute: Int) {
  // The same rule as localToUtc in src/domain/local-time.ts: a repeated wall time resolves to its
  // first occurrence and a skipped one moves forward by the length of the gap. java.time would
  // need API 26 or desugaring, and Calendar resolves repeated times to the second occurrence.
  fun toInstant(offsetAt: OffsetAt): Long {
    val wall = wallAsUtc()
    val offsetBefore = offsetAt(wall - MS_PER_DAY)
    val offsetAfter = offsetAt(wall + MS_PER_DAY)
    val matching = listOf(offsetBefore, offsetAfter)
      .map { offset -> wall - offset * MS_PER_MINUTE }
      .filter { candidate -> wall - offsetAt(candidate) * MS_PER_MINUTE == candidate }
    return matching.minOrNull() ?: (wall - offsetBefore * MS_PER_MINUTE)
  }

  private fun wallAsUtc(): Long {
    val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
    calendar.clear()
    calendar.set(year, month - 1, day, hour, minute, 0)
    return calendar.timeInMillis
  }
}

fun offsetsOf(zone: TimeZone): OffsetAt = { instant -> zone.getOffset(instant) / MS_PER_MINUTE.toInt() }
