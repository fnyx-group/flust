package org.fnyxgroup.flust.filter

import java.security.cert.Certificate
import java.security.cert.X509Certificate

// Checks the resolver's certificate names the resolver, after the TLS handshake has checked its
// chain. The handshake already does it through the endpoint identification of the TLS
// parameters; this second check does not depend on the TLS provider honoring them. Only DNS
// names in the subject alternative names count, as RFC 6125 asks, never the common name.
object CertificateCheck {
  private const val DNS_NAME = 2

  fun names(certificates: Array<out Certificate>, host: String): Boolean {
    val leaf = certificates.firstOrNull() as? X509Certificate ?: return false
    val names = leaf.subjectAlternativeNames
      ?.filter { (it[0] as? Int) == DNS_NAME }
      ?.mapNotNull { it[1] as? String }
      ?: return false
    val expected = host.lowercase()
    return names.any { matches(it.lowercase().removeSuffix("."), expected) }
  }

  // A wildcard covers exactly one whole label, the left-most one.
  internal fun matches(pattern: String, host: String): Boolean {
    if (!pattern.startsWith("*.")) return pattern == host
    val suffix = pattern.substring(1)
    if (suffix.count { it == '.' } < 2 || !host.endsWith(suffix)) return false
    val label = host.substring(0, host.length - suffix.length)
    return label.isNotEmpty() && '.' !in label
  }
}
