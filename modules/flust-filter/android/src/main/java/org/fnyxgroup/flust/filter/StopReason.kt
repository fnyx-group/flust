package org.fnyxgroup.flust.filter

// Why the tunnel last stopped, for the app to show. No browsing data: one word.
enum class StopReason(val code: String) {
  STOPPED("stopped"),
  REVOKED("revoked"),
  NO_CONSENT("no-consent"),
  FAILED("failed"),
  // The compiled lists could not be read: only a new install brings them back.
  LISTS("lists"),
  // Android refused to start the service after a reboot. Not a failure: flust resumes the filter
  // when it is opened, and the always-on setting avoids it.
  BOOT_DEFERRED("boot-deferred"),
}
