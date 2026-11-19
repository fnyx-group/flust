package org.fnyxgroup.flust.filter

import java.net.InetAddress

// The resolver: Quad9 over DNS over TLS, reached by its fixed addresses, so that flust never
// looks up its name, which strict mode blocks for every app. The certificate must be valid for
// dns.quad9.net. See docs/decisions/0033-android-filter-network-access.md.
object Quad9 {
  const val HOST = "dns.quad9.net"
  const val PORT = 853

  private val IPV4 = Regex("^(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(\\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])){3}$")
  private val IPV6 = Regex("^[0-9a-f]*(:[0-9a-f]*){2,7}$")

  // IPv4 first: an IPv6-only network still reaches it through the phone's 464XLAT, and an IPv4
  // failure there is immediate.
  val ENDPOINT = ResolverEndpoint(
    HOST,
    PORT,
    listOf("9.9.9.9", "149.112.112.112", "2620:fe::fe", "2620:fe::9").map(::literal),
  )

  // getByName parses a literal address and looks up anything else: only IPv4 dotted digits and
  // IPv6 with colons reach it, never a name.
  internal fun literal(address: String): InetAddress {
    require(IPV4.matches(address) || IPV6.matches(address)) { "Not an IP literal: $address" }
    return InetAddress.getByName(address)
  }
}
