package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Test

class FilterPolicyTest {
  private fun decide(name: String, config: FilterConfig = FilterConfig(enabled = true)) =
    FilterPolicy(TestData.lists, config).decide(name)

  @Test
  fun blocksTheCategoriesThatAreOn() {
    assertEquals(Decision.Block, decide("adult.example"))
    assertEquals(Decision.Block, decide("Video.Adult.Example."))
    assertEquals(Decision.Block, decide("deepfake.example"))
    assertEquals(Decision.Forward, decide("companion.example"))
    assertEquals(Decision.Forward, decide("adult.example", FilterConfig(adult = false)))
  }

  @Test
  fun forwardsEverythingElse() {
    assertEquals(Decision.Forward, decide("example.org"))
    assertEquals(Decision.Forward, decide(""))
  }

  @Test
  fun letsAnExceptionThroughWithTheNamesUnderIt() {
    val config = FilterConfig(exceptions = setOf("adult.example"))
    assertEquals(Decision.Forward, decide("adult.example", config))
    assertEquals(Decision.Forward, decide("cdn.adult.example", config))
    assertEquals(Decision.Block, decide("adult-two.example", config))
  }

  @Test
  fun keepsStrictModeAboveTheExceptions() {
    val excepted = setOf("doh.example", "use-application-dns.net", "vpn.example")
    assertEquals(Decision.Block, decide("doh.example", FilterConfig(exceptions = excepted)))
    assertEquals(Decision.Block, decide("use-application-dns.net", FilterConfig(exceptions = excepted)))
    assertEquals(Decision.Block, decide("dl.vpn.example", FilterConfig(exceptions = excepted)))
    assertEquals(Decision.Forward, decide("doh.example", FilterConfig(strict = false)))
  }

  @Test
  fun rewritesSearchEnginesToTheirRestrictedVersion() {
    assertEquals(Decision.Rewrite(SafeSearch.GOOGLE), decide("www.google.fr"))
    assertEquals(Decision.Rewrite(SafeSearch.GOOGLE), decide("google.com"))
    assertEquals(Decision.Rewrite(SafeSearch.BING), decide("www.bing.com"))
    assertEquals(Decision.Rewrite(SafeSearch.DUCKDUCKGO), decide("duckduckgo.com"))
    assertEquals(Decision.Rewrite(SafeSearch.YOUTUBE_MODERATE), decide("m.youtube.com"))
    assertEquals(
      Decision.Rewrite(SafeSearch.YOUTUBE_STRICT),
      decide("www.youtube.com", FilterConfig(youtube = YouTubeLevel.STRICT)),
    )
  }

  @Test
  fun leavesOtherGoogleNamesAlone() {
    assertEquals(Decision.Forward, decide("mail.google.com"))
    assertEquals(Decision.Forward, decide(SafeSearch.GOOGLE))
    assertEquals(Decision.Forward, decide("www.google.org"))
  }

  @Test
  fun keepsSafeSearchForASearchDomainUnderAnException() {
    assertEquals(Decision.Rewrite(SafeSearch.GOOGLE), decide("www.google.com", FilterConfig(exceptions = setOf("google.com"))))
  }
}
