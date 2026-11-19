package org.fnyxgroup.flust.filter

// What flust needs to know about one of the phone's networks, read by NetworkState.
data class NetworkView(val vpn: Boolean, val privateDnsServer: String?)

// The ways around the filter that flust can see from the networks (docs/product/content-filter.md,
// Known limits). Apart from Android, so the JVM tests cover it.
object NetworkChecks {
  // Private DNS set to a hostname sends lookups over TLS to that server, around the tunnel.
  // Automatic mode has no hostname and falls back to the tunnel's DNS.
  fun strictPrivateDns(networks: List<NetworkView>): Boolean =
    networks.any { !it.privateDnsServer.isNullOrBlank() }

  // Android runs one VPN at a time: a VPN network while flust's tunnel is down is another app's.
  fun otherVpn(networks: List<NetworkView>, filterRunning: Boolean): Boolean =
    !filterRunning && networks.any { it.vpn }
}
