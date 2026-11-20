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

  private fun transport(server: TestTls.Server, host: String = Resolvers.QUAD9.host, addresses: List<InetAddress> = listOf(TestTls.loopback)) =
    ResolverTransport(
      ResolverEndpoint(host, server.port, addresses),
      { socket -> protected += socket; protects },
      TestTls.clientContext,
      connectTimeoutMillis = 2_000,
      readTimeoutMillis = 2_000,
    )

  @Test
  fun exchangesAQueryOverTlsWithTheResolver() {
    TestTls.Server(TestTls.signedFor(Resolvers.QUAD9.host)).use { server ->
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
    TestTls.Server(TestTls.signedFor(Resolvers.QUAD9.host)).use { server ->
      val elsewhere = InetAddress.getByName("127.0.0.2")

      assertThrows(IllegalArgumentException::class.java) { transport(server).open(elsewhere) }
      assertTrue(protected.isEmpty())
      assertEquals(0, server.accepted.get())
    }
  }

  @Test
  fun doesNotConnectWhenTheSocketCannotLeaveTheTunnel() {
    protects = false
    TestTls.Server(TestTls.signedFor(Resolvers.QUAD9.host)).use { server ->
      assertThrows(IOException::class.java) { transport(server).connect() }
      Thread.sleep(200)
      assertEquals(0, server.accepted.get())
    }
  }

  @Test
  fun triesTheNextAddressWhenOneFails() {
    TestTls.Server(TestTls.signedFor(Resolvers.QUAD9.host)).use { server ->
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
  fun reachesEachResolverOfTheChainByItsAddressesOnTheDnsOverTlsPort() {
    assertEquals(
      listOf("dns.quad9.net", "protective.joindns4.eu", "security.cloudflare-dns.com"),
      Resolvers.CHAIN.map { it.host },
    )
    assertTrue(Resolvers.CHAIN.all { it.port == 853 })
    assertEquals(
      listOf(
        listOf("9.9.9.9", "149.112.112.112", "2620:fe:0:0:0:0:0:fe", "2620:fe:0:0:0:0:0:9"),
        listOf("86.54.11.1", "86.54.11.201", "2a13:1001:0:0:86:54:11:1", "2a13:1001:0:0:86:54:11:201"),
        listOf("1.1.1.2", "1.0.0.2", "2606:4700:4700:0:0:0:0:1112", "2606:4700:4700:0:0:0:0:1002"),
      ),
      Resolvers.CHAIN.map { endpoint -> endpoint.addresses.map { it.hostAddress } },
    )
    // Routed into the tunnel, so that an app that queries one of them directly is filtered too.
    val routed = TunnelRoutes.RESOLVERS.map { InetAddress.getByName(it).hostAddress }
    assertTrue(Resolvers.CHAIN.flatMap { it.addresses }.all { it.hostAddress in routed })
  }

  @Test
  fun givesUpOnceTheConnectBudgetIsSpent() {
    java.net.ServerSocket(0, 1, TestTls.loopback).use { silent ->
      // Once its backlog is full, the kernel drops the next connection attempts unanswered, as a
      // resolver that filters this phone would.
      val queued = (1..2).map { Socket(TestTls.loopback, silent.localPort) }
      val transport = ResolverTransport(
        ResolverEndpoint(Resolvers.QUAD9.host, silent.localPort, listOf(TestTls.loopback)),
        { true },
        TestTls.clientContext,
        connectTimeoutMillis = 5_000,
        readTimeoutMillis = 5_000,
      )
      val started = System.nanoTime()
      assertThrows(IOException::class.java) { transport.connect(budgetMillis = 300) }
      assertTrue((System.nanoTime() - started) / 1_000_000 < 2_000)
      queued.forEach(Socket::close)
    }
  }

  @Test
  fun checksTheNamesOfTheCertificate() {
    assertTrue(CertificateCheck.names(TestTls.certificates(TestTls.signedFor(Resolvers.QUAD9.host)), Resolvers.QUAD9.host))
    assertTrue(CertificateCheck.names(TestTls.certificates(TestTls.signedFor(Resolvers.QUAD9.host)), "DNS.Quad9.net"))
    assertFalse(CertificateCheck.names(TestTls.certificates(TestTls.signedFor("other.example")), Resolvers.QUAD9.host))
    assertFalse(CertificateCheck.names(emptyArray(), Resolvers.QUAD9.host))
  }

  @Test
  fun letsAWildcardCoverOneLeftLabelOnly() {
    assertTrue(CertificateCheck.matches("*.quad9.net", "dns.quad9.net"))
    assertFalse(CertificateCheck.matches("*.quad9.net", "a.dns.quad9.net"))
    assertFalse(CertificateCheck.matches("*.quad9.net", "quad9.net"))
    assertFalse(CertificateCheck.matches("*.net", "quad9.net"))
    assertFalse(CertificateCheck.matches("dns.quad9.net", "dns.quad9.net.evil.example"))
  }

  @Test
  fun buildsTheResolverAddressesFromLiteralsOnly() {
    assertEquals("9.9.9.9", Resolvers.literal("9.9.9.9").hostAddress)
    assertEquals("2620:fe:0:0:0:0:0:fe", Resolvers.literal("2620:fe::fe").hostAddress)
    for (name in listOf("cafe.fade", "dns.quad9.net", "9.9.9.999", "9.9.9", "fe", "")) {
      assertThrows(IllegalArgumentException::class.java) { Resolvers.literal(name) }
    }
  }

  @Test
  fun keepsTls12AndLaterOnly() {
    assertEquals(
      listOf("TLSv1.3", "TLSv1.2"),
      ResolverTransport.modernProtocols(arrayOf("TLSv1.3", "TLSv1.2", "TLSv1.1", "TLSv1")).toList(),
    )
    assertThrows(IOException::class.java) { ResolverTransport.modernProtocols(arrayOf("TLSv1.1", "TLSv1")) }
  }
}
