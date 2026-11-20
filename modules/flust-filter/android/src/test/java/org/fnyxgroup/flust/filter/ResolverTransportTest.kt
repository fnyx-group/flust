package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.IOException
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketAddress
import java.net.SocketTimeoutException
import kotlin.concurrent.thread

class ResolverTransportTest {
  private val protected = mutableListOf<Socket>()
  private var protects = true

  private fun transport(server: TestTls.Server, host: String = Resolvers.QUAD9.host, addresses: List<InetAddress> = listOf(TestTls.loopback)) =
    ResolverTransport(
      ResolverEndpoint(host, server.port, addresses),
      { socket -> protected += socket; protects },
      TestTls.clientContext,
      connectTimeoutMillis = 2_000,
    )

  // A socket whose connection never answers: each attempt takes its whole timeout, then fails.
  private class StallingSocket(private val attempts: MutableList<Int>) : Socket() {
    override fun connect(endpoint: SocketAddress, timeout: Int) {
      attempts += timeout
      Thread.sleep(timeout.toLong())
      throw SocketTimeoutException("connect timed out")
    }
  }

  // A TCP server that accepts connections and never says a word, the TLS handshake included.
  private fun silentServer(use: (ServerSocket) -> Unit) {
    ServerSocket(0, 8, TestTls.loopback).use { server ->
      val held = mutableListOf<Socket>()
      thread(isDaemon = true) {
        while (!server.isClosed) held += try { server.accept() } catch (closed: IOException) { break }
      }
      use(server)
      held.forEach(Socket::close)
    }
  }

  private fun millisSince(started: Long) = (System.nanoTime() - started) / 1_000_000

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
      listOf("dns.quad9.net", "security.cloudflare-dns.com", "protective.joindns4.eu"),
      Resolvers.CHAIN.map { it.host },
    )
    assertTrue(Resolvers.CHAIN.all { it.port == 853 })
    assertEquals(
      listOf(
        listOf("9.9.9.9", "149.112.112.112", "2620:fe:0:0:0:0:0:fe", "2620:fe:0:0:0:0:0:9"),
        listOf("1.1.1.2", "1.0.0.2", "2606:4700:4700:0:0:0:0:1112", "2606:4700:4700:0:0:0:0:1002"),
        listOf("86.54.11.1", "86.54.11.201", "2a13:1001:0:0:86:54:11:1", "2a13:1001:0:0:86:54:11:201"),
      ),
      Resolvers.CHAIN.map { endpoint -> endpoint.addresses.map { it.hostAddress } },
    )
    // Routed into the tunnel, so that an app that queries one of them directly is filtered too.
    val routed = TunnelRoutes.RESOLVERS.map { InetAddress.getByName(it).hostAddress }
    assertTrue(Resolvers.CHAIN.flatMap { it.addresses }.all { it.hostAddress in routed })
  }

  @Test
  fun givesUpOnceTheConnectBudgetIsSpent() {
    val attempts = mutableListOf<Int>()
    val addresses = listOf("127.0.0.2", "127.0.0.3", "127.0.0.4", "127.0.0.5").map(InetAddress::getByName)
    val transport = ResolverTransport(
      ResolverEndpoint(Resolvers.QUAD9.host, 853, addresses),
      { true },
      TestTls.clientContext,
      connectTimeoutMillis = 5_000,
      newSocket = { StallingSocket(attempts) },
    )

    assertThrows(SocketTimeoutException::class.java) { transport.connect(Timeouts(300, 2_000, 3_000)) }
    assertTrue(attempts.first() in 250..300)
    assertTrue(attempts.sum() <= 300)
  }

  @Test
  fun givesEachAddressItsOwnConnectTimeoutWithinTheBudget() {
    val attempts = mutableListOf<Int>()
    val addresses = listOf("127.0.0.2", "127.0.0.3").map(InetAddress::getByName)
    val transport = ResolverTransport(
      ResolverEndpoint(Resolvers.QUAD9.host, 853, addresses),
      { true },
      TestTls.clientContext,
      connectTimeoutMillis = 100,
      newSocket = { StallingSocket(attempts) },
    )

    assertThrows(SocketTimeoutException::class.java) { transport.connect(Timeouts(1_000, 2_000, 3_000)) }
    assertEquals(listOf(100, 100), attempts)
  }

  @Test
  fun givesUpOnAHandshakeThatStalls() {
    silentServer { server ->
      val transport = ResolverTransport(
        ResolverEndpoint(Resolvers.QUAD9.host, server.localPort, listOf(TestTls.loopback)),
        { true },
        TestTls.clientContext,
      )
      val started = System.nanoTime()

      assertThrows(SocketTimeoutException::class.java) { transport.connect(Timeouts(1_000, 300, 5_000)) }
      assertTrue(millisSince(started) < 2_000)
    }
  }

  @Test
  fun waitsForAnAnswerNoLongerThanTheReadBudget() {
    TestTls.Server(TestTls.signedFor(Resolvers.QUAD9.host), answers = false).use { server ->
      val connection = transport(server).connect(Timeouts(1_000, 2_000, 5_000))
      val started = System.nanoTime()

      assertThrows(SocketTimeoutException::class.java) { connection.exchange(TestData.query("example.org"), readMillis = 300) }
      assertTrue(millisSince(started) < 2_000)
      connection.close()
    }
  }

  // Stopping the filter ends a connection still in its handshake, and opens no new one.
  @Test
  fun closesItsSocketsAndRefusesNewOnes() {
    silentServer { server ->
      val transport = ResolverTransport(
        ResolverEndpoint(Resolvers.QUAD9.host, server.localPort, listOf(TestTls.loopback)),
        { true },
        TestTls.clientContext,
      )
      var failure: Exception? = null
      val probe = thread {
        failure = try {
          transport.connect(Timeouts(1_000, 10_000, 10_000))
          null
        } catch (error: Exception) {
          error
        }
      }
      Thread.sleep(300)
      val started = System.nanoTime()

      transport.close()
      probe.join(5_000)
      assertTrue(millisSince(started) < 2_000)
      assertTrue(failure is IOException)
      assertFalse(failure is SocketTimeoutException)
      assertThrows(IOException::class.java) { transport.connect() }
    }
  }

  // Strict mode blocks the names of the filter's own resolvers for every app, like those of the
  // other DoH and DoT providers.
  @Test
  fun findsEveryResolverOfTheChainInTheBypassList() {
    var directory: File? = File(System.getProperty("user.dir")).absoluteFile
    while (directory != null && !File(directory, "lists/flust/bypass.txt").isFile) directory = directory.parentFile
    val bypass = File(checkNotNull(directory) { "lists/flust/bypass.txt not found" }, "lists/flust/bypass.txt")
    val names = bypass.readLines().map { it.substringBefore('#').trim().lowercase() }.filter { it.isNotEmpty() }.toSet()

    for (endpoint in Resolvers.CHAIN) assertTrue(endpoint.host, endpoint.host in names)
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
