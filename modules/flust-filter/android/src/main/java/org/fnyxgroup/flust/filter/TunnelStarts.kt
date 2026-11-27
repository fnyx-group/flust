package org.fnyxgroup.flust.filter

// The starts of the tunnel whose preparation runs off the main thread. Each start gets a ticket,
// and only the latest one may set up its tunnel: a stop, a revoked consent or a newer setting
// makes an earlier preparation stale, so it never sets up a tunnel the person no longer wants.
// Used from the main thread only.
//
// A start stays under way from `begin` until `done`, after its tunnel is set up or has failed,
// or until a cancel. `done` is not called when setting up the tunnel throws, so a crash in the
// middle of a start still finds it under way (CrashRestart).
class TunnelStarts(private val onUnderWay: (Boolean) -> Unit = {}) {
  private var latest = 0L

  // The settings being prepared, if a start is under way.
  var pending: FilterConfig? = null
    private set

  var underWay = false
    private set(value) {
      field = value
      onUnderWay(value)
    }

  fun begin(config: FilterConfig): Long {
    latest += 1
    pending = config
    underWay = true
    return latest
  }

  fun cancel() {
    latest += 1
    pending = null
    underWay = false
  }

  // True when the ticket is still the latest start, which may then set up its tunnel.
  fun finish(ticket: Long): Boolean {
    if (ticket != latest) return false
    pending = null
    return true
  }

  // The finished start has set up its tunnel or failed. A newer start keeps it under way.
  fun done() {
    if (pending == null) underWay = false
  }

  // A start for these settings would change nothing: they are being prepared, or they already run
  // and nothing else is being prepared.
  fun covers(config: FilterConfig, running: FilterConfig?): Boolean =
    pending?.filtering == config.filtering || (pending == null && running?.filtering == config.filtering)
}
