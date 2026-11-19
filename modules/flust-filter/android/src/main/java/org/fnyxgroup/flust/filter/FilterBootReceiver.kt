package org.fnyxgroup.flust.filter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService

// Restarts the filter after a reboot or an update, when it was on and the VPN consent still
// holds. Android may refuse to start a service from the background: the filter then starts again
// when flust is opened, and the always-on VPN setting starts it at boot without flust.
class FilterBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in RESTART_ACTIONS) return
    if (!FilterConfigStore(context).load().enabled || VpnService.prepare(context) != null) return
    try {
      FilterVpnService.start(context)
    } catch (refused: IllegalStateException) {
      FilterStatus.recordStop(context, StopReason.BOOT_DEFERRED)
    }
  }

  private companion object {
    val RESTART_ACTIONS = setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED)
  }
}
