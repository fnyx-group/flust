package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.InetAddress
import java.net.Socket

class ResolverTransportTest {
  private val protected = mutableListOf<Socket>()
  private var protects = true

  private fun transport(server: TestTls.Server, host: String = Quad9.HOST, addresses: List<InetAddress> = listOf(TestTls.loopback)) =
    ResolverTransport(
      ResolverEndpoint(host, server.port, addresses),
      { socket -> protected += socket; protects },
      TestTls.clientContext,
      connectTimeoutMillis = 2_000,
      readTimeoutMillis = 2_000,
    )

  @Test
  fun exchangesAQueryOverTlsWithTheResolver() {
    TestTls.Server(TestTls.signedFor(Quad9.HOST)).use { server ->
      val query = TestData.query("example.org")
      val connection = transport(server).connect()

      assertTrue(Dns.matches(query, connection.exchange(query)))
      assertTrue(Dns.matches(query, connection.exchange(query)))
      assertEquals(1, protected.size)
      assertEquals(1, server.accepted.get())
      connection.close()
    }
  }

  @Test
  fun refusesACertificateForAnotherName() {
    TestTls.Server(TestTls.signedFor("other.example")).use { server ->
      assertThrows(IOException::class.java) { transport(server).connect() }
    }
  }

  @Test
  fun refusesACertificateNoTrustedAuthoritySigned() {
    TestTls.Server(TestTls.selfSigned).use { server ->
      assertThrows(IOException::class.java) { transport(server).connect() }
    }
  }

  @Test
  fun neverOpensASocketToAnAddressOutsideTheResolver() {
    TestTls.Server(TestTls.signedFor(Quad9.HOST)).use { server ->
      val elsewhere = InetAddress.getByName("127.0.0.2")

      assertThrows(IllegalArgumentException::class.java) { transport(server).open(elsewhere) }
      assertTrue(protected.isEmpty())
      assertEquals(0, server.accepted.get())
    }
  }

  @Test
  fun doesNotConnectWhenTheSocketCannotLeaveTheTunnel() {
    protects = false
    TestTls.Server(TestTls.signedFor(Quad9.HOST)).use { server ->
      assertThrows(IOException::class.java) { transport(server).connect() }
      Thread.sleep(200)
      assertEquals(0, server.accepted.get())
    }
  }

  @Test
  fun triesTheNextAddressWhenOneFails() {
    TestTls.Server(TestTls.signedFor(Quad9.HOST)).use { server ->
      val unreachable = InetAddress.getByName("127.0.0.2")
      val connection = transport(server, addresses = listOf(unreachable, TestTls.loopback)).connect()

      assertTrue(Dns.matches(TestData.query("example.org"), connection.exchange(TestData.query("example.org"))))
      connection.close()
    }
  }

  // Strict mode blocks the resolver's name for every app; flust reaches the resolver by address,
  // without a lookup, so the block does not touch it.
  @Test
  fun reachesTheResolverWhoseNameStrictModeBlocks() {
    assertEquals(Decision.Block, FilterPolicy(TestData.lists, FilterConfig()).decide("doh.example"))
    TestTls.Server(TestTls.signedFor("doh.example")).use { server ->
      val connection = transport(server, host = "doh.example").connect()

      assertTrue(Dns.matches(TestData.query("example.org"), connection.exchange(TestData.query("example.org"))))
      connection.close()
    }
  }

  @Test
  fun reachesQuad9ByItsAddressesOnTheDnsOverTlsPort() {
    assertEquals("dns.quad9.net", Quad9.ENDPOINT.host)
    assertEquals(853, Quad9.ENDPOINT.port)
    assertEquals(
      listOf("9.9.9.9", "149.112.112.112", "2620:fe:0:0:0:0:0:fe", "2620:fe:0:0:0:0:0:9"),
      Quad9.ENDPOINT.addresses.map { it.hostAddress },
    )
    assertTrue(Quad9.ENDPOINT.addresses.all { it.hostAddress in TunnelRoutes.RESOLVERS.map { route -> InetAddress.getByName(route).hostAddress } })
  }

  @Test
  fun checksTheNamesOfTheCertificate() {
    assertTrue(CertificateCheck.names(TestTls.certificates(TestTls.signedFor(Quad9.HOST)), Quad9.HOST))
    assertTrue(CertificateCheck.names(TestTls.certificates(TestTls.signedFor(Quad9.HOST)), "DNS.Quad9.net"))
    assertFalse(CertificateCheck.names(TestTls.certificates(TestTls.signedFor("other.example")), Quad9.HOST))
    assertFalse(CertificateCheck.names(emptyArray(), Quad9.HOST))
  }

  @Test
  fun letsAWildcardCoverOneLeftLabelOnly() {
    assertTrue(CertificateCheck.matches("*.quad9.net", "dns.quad9.net"))
    assertFalse(CertificateCheck.matches("*.quad9.net", "a.dns.quad9.net"))
    assertFalse(CertificateCheck.matches("*.quad9.net", "quad9.net"))
    assertFalse(CertificateCheck.matches("*.net", "quad9.net"))
    assertFalse(CertificateCheck.matches("dns.quad9.net", "dns.quad9.net.evil.example"))
  }
}
