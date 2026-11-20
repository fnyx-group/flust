package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FilterConfigTest {
  @Test
  fun startsWithTheDefaultsOfTheDesign() {
    val config = FilterConfig()
    assertEquals(false, config.enabled)
    assertEquals(true, config.strict)
    assertEquals(YouTubeLevel.MODERATE, config.youtube)
    assertEquals(Categories.ADULT or Categories.AI_NUDIFY, config.blockedCategories)
  }

  @Test
  fun survivesARoundTrip() {
    val config = FilterConfig(
      enabled = true,
      adult = false,
      aiNudify = false,
      strict = false,
      youtube = YouTubeLevel.STRICT,
      exceptions = setOf("example.org", "cdn.example.net"),
    )
    assertEquals(config, FilterConfig.decode(config.encode()))
  }

  @Test
  fun fallsBackToTheDefaultsForWhatItCannotRead() {
    assertEquals(FilterConfig(), FilterConfig.decode("garbage\nenabled=maybe\nyoutube=LOUD\nexception=not a domain\n"))
  }

  @Test
  fun keepsOnlyExceptionsThatAreDomains() {
    assertEquals("example.org", FilterConfig.exceptionName(" Example.ORG. "))
    assertNull(FilterConfig.exceptionName("localhost"))
    assertNull(FilterConfig.exceptionName("exa mple.org"))
    assertNull(FilterConfig.exceptionName("*.example.org"))
  }
}
