package org.fnyxgroup.flust.filter

sealed interface Decision {
  data object Block : Decision
  data object Forward : Decision
  data class Rewrite(val target: String) : Decision
}

// What the filter does with a name. The strict guard comes first, so that no user exception can
// reopen a bypass; SafeSearch next, so that an exception for a search domain keeps it restricted.
class FilterPolicy(private val lists: Blocklist, private val config: FilterConfig) {
  fun decide(queried: String): Decision {
    val name = queried.lowercase().removeSuffix(".")
    val categories = lists.categories(name)
    if (config.strict && categories and Categories.BYPASS != 0) return Decision.Block
    SafeSearch.target(name, config.youtube) { lists.exact(it) and Categories.GOOGLE != 0 }
      ?.let { return Decision.Rewrite(it) }
    if (isException(name)) return Decision.Forward
    return if (categories and config.blockedCategories != 0) Decision.Block else Decision.Forward
  }

  private fun isException(name: String): Boolean =
    config.exceptions.any { name == it || name.endsWith(".$it") }
}
