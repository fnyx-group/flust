package org.fnyxgroup.flust.filter

// The addresses of the tunnel. Apps send their lookups to the fake DNS address, which exists only
// inside the tunnel. The public resolvers' addresses are routed into it as well, so that an app
// that queries one directly is filtered too; all other traffic stays outside flust.
object TunnelRoutes {
  const val SESSION = "flust"
  const val MTU = 1500

  const val INTERFACE_V4 = "10.111.222.1"
  const val INTERFACE_V6 = "fd66:6c75:7374::1"

  // Two pairs of fake DNS addresses, used in turn each time the tunnel is set up again. When a
  // network's DNS servers change, Android tells apps to empty their Java address cache. Its
  // resolver keeps its own cache: the new tunnel updates the same network, and the resolver empties
  // a network's cache only when told to or when the network goes away. Every address is answered
  // the same way.
  val DNS = listOf(
    DnsAddresses("10.111.222.2", "fd66:6c75:7374::2"),
    DnsAddresses("10.111.222.3", "fd66:6c75:7374::3"),
  )

  // The addresses of the providers in Chromium's list of DNS over HTTPS providers
  // (net/dns/public/doh_provider_entry.cc, checked 2026-11-19), which holds the filter's own resolvers
  // (Resolvers.CHAIN): flust's own sockets to them are protected and leave the tunnel.
  val RESOLVERS = listOf(
    "1.0.0.1", "1.0.0.2", "1.0.0.3", "1.1.1.1", "1.1.1.2", "1.1.1.3",
    "8.8.4.4", "8.8.8.8",
    "9.9.9.9", "9.9.9.10", "9.9.9.11", "149.112.112.10", "149.112.112.11", "149.112.112.112",
    "45.11.45.11", "185.222.222.222",
    "68.105.28.11", "68.105.28.12", "75.75.75.75", "75.75.76.76",
    "86.54.11.1", "86.54.11.201",
    "109.236.119.2", "109.236.120.2",
    "185.228.168.9", "185.228.168.10", "185.228.168.168",
    "185.228.169.9", "185.228.169.11", "185.228.169.168",
    "185.43.135.1", "193.17.47.1",
    "208.67.220.123", "208.67.220.220", "208.67.222.123", "208.67.222.222",
    "209.18.47.61", "209.18.47.62",
    "212.60.61.246", "212.60.63.246",
    "2001:148f:fffe::1", "2001:148f:ffff::1",
    "2001:1998:f00:1::1", "2001:1998:f00:2::1",
    "2001:1a88:10:ffff::1", "2001:1a88:10:ffff::2",
    "2001:4860:4860::64", "2001:4860:4860::6464", "2001:4860:4860::8844", "2001:4860:4860::8888",
    "2001:558:feed::1", "2001:558:feed::2", "2001:578:3f::30",
    "2606:4700:4700::1001", "2606:4700:4700::1002", "2606:4700:4700::1003",
    "2606:4700:4700::1111", "2606:4700:4700::1112", "2606:4700:4700::1113",
    "2620:119:35::35", "2620:119:35::123", "2620:119:53::53", "2620:119:53::123",
    "2620:fe::9", "2620:fe::10", "2620:fe::11", "2620:fe::fe", "2620:fe::fe:10", "2620:fe::fe:11",
    "2a02:6ca3:0:1::2", "2a02:6ca3:0:2::2",
    "2a09::", "2a11::",
    "2a0d:2a00:1::", "2a0d:2a00:1::1", "2a0d:2a00:1::2",
    "2a0d:2a00:2::", "2a0d:2a00:2::1", "2a0d:2a00:2::2",
    "2a13:1001::86:54:11:1", "2a13:1001::86:54:11:201",
  )

  fun prefixLength(address: String) = if (':' in address) 128 else 32
}

data class DnsAddresses(val v4: String, val v6: String)
