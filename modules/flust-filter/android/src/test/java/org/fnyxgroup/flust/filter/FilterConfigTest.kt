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
      notification = words("Service en arrière-plan", "Actif en arrière-plan"),
    )
    assertEquals(config, FilterConfig.decode(config.encode()))
  }

  @Test
  fun keepsNoNotificationWordsUntilTheAppGivesThem() {
    assertNull(FilterConfig.decode(FilterConfig(enabled = true).encode()).notification)
  }

  @Test
  fun keepsNotificationWordsOnOneLineSoTheyCannotChangeASetting() {
    val injected = NotificationText.of("Service\nenabled=false", "Actif\r\nyoutube=STRICT")
    val config = FilterConfig.decode(FilterConfig(enabled = true, notification = injected).encode())

    assertEquals(true, config.enabled)
    assertEquals(YouTubeLevel.MODERATE, config.youtube)
    assertEquals(words("Service enabled=false", "Actif youtube=STRICT"), config.notification)
  }

  @Test
  fun refusesBlankNotificationWordsAndBoundsTheirLength() {
    assertNull(NotificationText.of("  ", "Actif"))
    assertNull(NotificationText.of("Service", "\n"))
    assertEquals(120, NotificationText.of("x".repeat(500), "Actif")?.channelName?.length)
  }

  @Test
  fun leavesTheNotificationWordsOutOfWhatTheTunnelDependsOn() {
    val english = words("Background service", "Running in the background")
    assertEquals(FilterConfig(enabled = true), FilterConfig(enabled = true, notification = english).filtering)
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
