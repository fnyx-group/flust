package org.fnyxgroup.flust.filter

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

// Reads the phone's networks for NetworkChecks. Needs ACCESS_NETWORK_STATE
// (docs/decisions/0041-filter-network-permissions.md); without it, or on a failure, it reports no
// network, so the app shows no bypass rather than a wrong one.
object NetworkState {
  fun networks(context: Context): List<NetworkView> =
    try {
      val connectivity = context.getSystemService(ConnectivityManager::class.java) ?: return emptyList()
      // The only synchronous way to read every network: the callbacks that replace it need a
      // registration that outlives this call.
      @Suppress("DEPRECATION")
      connectivity.allNetworks.mapNotNull { network ->
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return@mapNotNull null
        val privateDns = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          connectivity.getLinkProperties(network)?.privateDnsServerName
        } else {
          null
        }
        NetworkView(capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN), privateDns)
      }
    } catch (refused: SecurityException) {
      emptyList()
    }
}
