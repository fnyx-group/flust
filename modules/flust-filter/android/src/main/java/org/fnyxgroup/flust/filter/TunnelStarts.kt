package org.fnyxgroup.flust.filter

// The starts of the tunnel whose preparation runs off the main thread. Each start gets a ticket,
// and only the latest one may set up its tunnel: a stop, a revoked consent or a newer setting
// makes an earlier preparation stale, so it never sets up a tunnel the person no longer wants.
// Used from the main thread only.
class TunnelStarts {
  private var latest = 0L

  // The settings being prepared, if a start is under way.
  var pending: FilterConfig? = null
    private set

  fun begin(config: FilterConfig): Long {
    latest += 1
    pending = config
    return latest
  }

  fun cancel() {
    latest += 1
    pending = null
  }

  // True when the ticket is still the latest start, which may then set up its tunnel.
  fun finish(ticket: Long): Boolean {
    if (ticket != latest) return false
    pending = null
    return true
  }

  // A start for these settings would change nothing: they are being prepared, or they already run
  // and nothing else is being prepared.
  fun covers(config: FilterConfig, running: FilterConfig?): Boolean =
    pending?.filtering == config.filtering || (pending == null && running?.filtering == config.filtering)
}
