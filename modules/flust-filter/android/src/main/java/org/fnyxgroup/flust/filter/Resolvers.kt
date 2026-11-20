package org.fnyxgroup.flust.filter

import java.net.InetAddress

// The resolvers, in the order the filter prefers them, each over DNS over TLS and reached by its
// fixed addresses, so that flust never looks up their names, which strict mode blocks for every
// app. Each certificate must be valid for the resolver's name. Addresses and names checked against
// each operator's documentation on 2026-11-20. See docs/decisions/0045-resolver-chain.md.
object Resolvers {
  const val PORT = 853

  private val IPV4 = Regex("^(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(\\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])){3}$")
  private val IPV6 = Regex("^[0-9a-f]*(:[0-9a-f]*){2,7}$")

  // IPv4 first in each: an IPv6-only network still reaches it through the phone's 464XLAT, and an
  // IPv4 failure there is immediate.
  val QUAD9 = endpoint("dns.quad9.net", "9.9.9.9", "149.112.112.112", "2620:fe::fe", "2620:fe::9")

  // Cloudflare's malware-blocking resolver comes before DNS4EU: it deletes its logs and the
  // truncated addresses within 25 hours, where DNS4EU keeps pseudonymous query logs for up to six
  // months and shares them with its project partners.
  val CLOUDFLARE = endpoint(
    "security.cloudflare-dns.com",
    "1.1.1.2",
    "1.0.0.2",
    "2606:4700:4700::1112",
    "2606:4700:4700::1002",
  )

  // DNS4EU's Protective resolution, which blocks malware like the two others.
  val DNS4EU = endpoint(
    "protective.joindns4.eu",
    "86.54.11.1",
    "86.54.11.201",
    "2a13:1001::86:54:11:1",
    "2a13:1001::86:54:11:201",
  )

  val CHAIN = listOf(QUAD9, CLOUDFLARE, DNS4EU)
  val NAMES = listOf("Quad9", "Cloudflare", "DNS4EU")

  private fun endpoint(host: String, vararg addresses: String) =
    ResolverEndpoint(host, PORT, addresses.map(::literal))

  // getByName parses a literal address and looks up anything else: only IPv4 dotted digits and
  // IPv6 with colons reach it, never a name.
  internal fun literal(address: String): InetAddress {
    require(IPV4.matches(address) || IPV6.matches(address)) { "Not an IP literal: $address" }
    return InetAddress.getByName(address)
  }
}
