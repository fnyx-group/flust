package org.fnyxgroup.flust.filter

import java.net.InetAddress

// The resolver: Quad9 over DNS over TLS, reached by its fixed addresses, so that flust never
// looks up its name, which strict mode blocks for every app. The certificate must be valid for
// dns.quad9.net. See docs/decisions/0033-android-filter-network-access.md.
object Quad9 {
  const val HOST = "dns.quad9.net"
  const val PORT = 853

  private val LITERAL = Regex("^[0-9a-f.:]+$")

  // IPv4 first: an IPv6-only network still reaches it through the phone's 464XLAT, and an IPv4
  // failure there is immediate.
  val ENDPOINT = ResolverEndpoint(
    HOST,
    PORT,
    listOf("9.9.9.9", "149.112.112.112", "2620:fe::fe", "2620:fe::9").map(::literal),
  )

  // getByName only parses a literal address, it never resolves one: the check keeps it that way.
  private fun literal(address: String): InetAddress {
    require(LITERAL.matches(address)) { "Not an IP literal: $address" }
    return InetAddress.getByName(address)
  }
}
