package org.fnyxgroup.flust.filter

enum class YouTubeLevel { MODERATE, STRICT }

// What the person chose. Kept by FilterConfigStore, encrypted, apart from the database and its key.
data class FilterConfig(
  val enabled: Boolean = false,
  val adult: Boolean = true,
  val aiNudify: Boolean = true,
  val aiCompanions: Boolean = false,
  val strict: Boolean = true,
  val youtube: YouTubeLevel = YouTubeLevel.MODERATE,
  val exceptions: Set<String> = emptySet(),
) {
  val blockedCategories: Int
    get() =
      (if (adult) Categories.ADULT else 0) or
        (if (aiNudify) Categories.AI_NUDIFY else 0) or
        (if (aiCompanions) Categories.AI_COMPANIONS else 0)

  fun encode(): String = buildString {
    appendLine("enabled=$enabled")
    appendLine("adult=$adult")
    appendLine("aiNudify=$aiNudify")
    appendLine("aiCompanions=$aiCompanions")
    appendLine("strict=$strict")
    appendLine("youtube=${youtube.name}")
    exceptions.sorted().forEach { appendLine("exception=$it") }
  }

  companion object {
    private val NAME = Regex("^[a-z0-9_-]+(\\.[a-z0-9_-]+)+$")

    // Lowercase, without a trailing dot. Null for anything that cannot be a domain.
    fun exceptionName(raw: String): String? =
      raw.trim().lowercase().removeSuffix(".").takeIf { it.length <= 253 && NAME.matches(it) }

    // Unknown keys and unreadable values fall back to the defaults, so an older or damaged file
    // still gives a working filter.
    fun decode(text: String): FilterConfig {
      val defaults = FilterConfig()
      val values = mutableMapOf<String, String>()
      val exceptions = mutableSetOf<String>()
      for (line in text.lineSequence()) {
        val key = line.substringBefore('=', "")
        val value = line.substringAfter('=', "")
        if (key == "exception") exceptionName(value)?.let(exceptions::add) else if (key != "") values[key] = value
      }
      fun flag(key: String, default: Boolean) = values[key]?.toBooleanStrictOrNull() ?: default
      return FilterConfig(
        enabled = flag("enabled", defaults.enabled),
        adult = flag("adult", defaults.adult),
        aiNudify = flag("aiNudify", defaults.aiNudify),
        aiCompanions = flag("aiCompanions", defaults.aiCompanions),
        strict = flag("strict", defaults.strict),
        youtube = YouTubeLevel.entries.firstOrNull { it.name == values["youtube"] } ?: defaults.youtube,
        exceptions = exceptions,
      )
    }
  }
}
