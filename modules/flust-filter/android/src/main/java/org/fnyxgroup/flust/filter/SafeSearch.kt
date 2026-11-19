package org.fnyxgroup.flust.filter

// Search engine names answered with a CNAME to their restricted version, as each engine
// documents for networks that force SafeSearch.
object SafeSearch {
  const val GOOGLE = "forcesafesearch.google.com"
  const val BING = "strict.bing.com"
  const val DUCKDUCKGO = "safe.duckduckgo.com"
  const val YOUTUBE_MODERATE = "restrictmoderate.youtube.com"
  const val YOUTUBE_STRICT = "restrict.youtube.com"

  private val BING_NAMES = setOf("bing.com", "www.bing.com")
  private val DUCKDUCKGO_NAMES = setOf("duckduckgo.com", "www.duckduckgo.com", "start.duckduckgo.com")
  private val YOUTUBE_NAMES = setOf(
    "www.youtube.com",
    "m.youtube.com",
    "youtubei.googleapis.com",
    "youtube.googleapis.com",
    "www.youtube-nocookie.com",
  )

  // Google's search domains come from lists/flust/google-domains.txt, with or without www.
  fun target(name: String, youtube: YouTubeLevel, isGoogleDomain: (String) -> Boolean): String? =
    when {
      name in BING_NAMES -> BING
      name in DUCKDUCKGO_NAMES -> DUCKDUCKGO
      name in YOUTUBE_NAMES -> if (youtube == YouTubeLevel.STRICT) YOUTUBE_STRICT else YOUTUBE_MODERATE
      isGoogleDomain(name.removePrefix("www.")) -> GOOGLE
      else -> null
    }
}
