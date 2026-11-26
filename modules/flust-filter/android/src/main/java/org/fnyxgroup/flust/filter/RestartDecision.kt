package org.fnyxgroup.flust.filter

// What a restart check does once flust was killed: start the filter only when the person left it
// on, Android still holds the VPN consent and no tunnel runs in this process.
enum class RestartDecision(val event: String) {
  START("start"),
  OFF("skipped, filter off"),
  NO_CONSENT("skipped, no consent"),
  RUNNING("skipped, already running");

  companion object {
    fun of(enabled: Boolean, consent: Boolean, running: Boolean): RestartDecision = when {
      !enabled -> OFF
      !consent -> NO_CONSENT
      running -> RUNNING
      else -> START
    }
  }
}
