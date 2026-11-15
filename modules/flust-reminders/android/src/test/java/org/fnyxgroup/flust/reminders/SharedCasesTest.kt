package org.fnyxgroup.flust.reminders

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.TimeZone

// The cases in test/fixtures/local-to-utc.tsv, also checked against localToUtc in
// src/domain/local-time.test.ts, so both conversions resolve every wall time the same way.
class SharedCasesTest {
  private fun wallOf(text: String): WallTime {
    val (year, month, day, hour, minute) = text.split('-', 'T', ':').map(String::toInt)
    return WallTime(year, month, day, hour, minute)
  }

  @Test
  fun resolvesEveryWallTimeLikeLocalToUtc() {
    val text = javaClass.getResource("/local-to-utc.tsv")?.readText()
      ?: error("local-to-utc.tsv is missing from the test resources")
    val cases = text.lines().filter { it.isNotBlank() && !it.startsWith("#") }
    check(cases.isNotEmpty())
    cases.forEach { line ->
      val (zone, local, utc) = line.split('\t')
      val expected = wallOf(utc).toInstant { 0 }
      assertEquals(line, expected, wallOf(local).toInstant(offsetsOf(TimeZone.getTimeZone(zone))))
    }
  }
}
