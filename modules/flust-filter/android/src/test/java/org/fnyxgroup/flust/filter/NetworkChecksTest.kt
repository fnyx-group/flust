package org.fnyxgroup.flust.filter

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NetworkChecksTest {
  private val wifi = NetworkView(vpn = false, privateDnsServer = null)
  private val vpn = NetworkView(vpn = true, privateDnsServer = null)

  @Test
  fun seesStrictPrivateDnsOnAnyNetwork() {
    assertTrue(NetworkChecks.strictPrivateDns(listOf(wifi, NetworkView(vpn = false, privateDnsServer = "dns.google"))))
    assertTrue(NetworkChecks.strictPrivateDns(listOf(NetworkView(vpn = true, privateDnsServer = "dns.example"))))
  }

  @Test
  fun leavesAutomaticPrivateDnsAlone() {
    assertFalse(NetworkChecks.strictPrivateDns(listOf(wifi, vpn)))
    assertFalse(NetworkChecks.strictPrivateDns(listOf(NetworkView(vpn = false, privateDnsServer = ""))))
    assertFalse(NetworkChecks.strictPrivateDns(emptyList()))
  }

  @Test
  fun seesAnotherVpnOnlyWhileTheFilterIsDown() {
    assertTrue(NetworkChecks.otherVpn(listOf(wifi, vpn), filterRunning = false))
    assertFalse(NetworkChecks.otherVpn(listOf(wifi, vpn), filterRunning = true))
    assertFalse(NetworkChecks.otherVpn(listOf(wifi), filterRunning = false))
  }
}
