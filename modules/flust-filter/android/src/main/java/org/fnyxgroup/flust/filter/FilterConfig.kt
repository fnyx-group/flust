package org.fnyxgroup.flust.filter

enum class YouTubeLevel { MODERATE, STRICT }

// The words of the foreground service's notification, in the language chosen in the app, which
// passes them. Kept with the settings so that a start without the app, at boot or by a job, uses
// them too. One line each, of bounded length, since the settings file has one value per line.
data class NotificationText(val channelName: String, val text: String) {
  companion object {
    private const val MAX_LENGTH = 120
    private val CONTROL = Regex("\\p{Cntrl}+")

    val DEFAULT = NotificationText(channelName = "Background service", text = "Running in the background")

    // Null when either is blank once cleaned.
    fun of(channelName: String, text: String): NotificationText? {
      val name = clean(channelName)
      val body = clean(text)
      return if (name.isEmpty() || body.isEmpty()) null else NotificationText(name, body)
    }

    private fun clean(raw: String): String = raw.replace(CONTROL, " ").trim().take(MAX_LENGTH).trim()
  }
}

// What the person chose. Kept by FilterConfigStore, encrypted, apart from the database and its key.
data class FilterConfig(
  val enabled: Boolean = false,
  val adult: Boolean = true,
  val aiNudify: Boolean = true,
  val strict: Boolean = true,
  val youtube: YouTubeLevel = YouTubeLevel.MODERATE,
  val exceptions: Set<String> = emptySet(),
  val notification: NotificationText? = null,
) {
  // What the tunnel depends on: new notification words alone never set up a new tunnel.
  val filtering: FilterConfig
    get() = copy(notification = null)

  val blockedCategories: Int
    get() =
      (if (adult) Categories.ADULT else 0) or (if (aiNudify) Categories.AI_NUDIFY else 0)

  fun encode(): String = buildString {
    appendLine("enabled=$enabled")
    appendLine("adult=$adult")
    appendLine("aiNudify=$aiNudify")
    appendLine("strict=$strict")
    appendLine("youtube=${youtube.name}")
    exceptions.sorted().forEach { appendLine("exception=$it") }
    notification?.let {
      appendLine("notificationChannel=${it.channelName}")
      appendLine("notificationText=${it.text}")
    }
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
        strict = flag("strict", defaults.strict),
        youtube = YouTubeLevel.entries.firstOrNull { it.name == values["youtube"] } ?: defaults.youtube,
        exceptions = exceptions,
        notification = NotificationText.of(values["notificationChannel"].orEmpty(), values["notificationText"].orEmpty()),
      )
    }
  }
}
