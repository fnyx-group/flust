package org.fnyxgroup.flust.filter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.IOException
import java.io.InputStream
import java.net.ConnectException
import java.net.SocketException
import java.net.SocketTimeoutException
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException

class DotClientTest {
  private var clock = 0L
  private val opened = mutableListOf<Fake>()

  private inner class Fake(answers: Int) {
    val written = ByteArrayOutputStream()
    var closed = false
    val connection: DotConnection

    init {
      val framed = ByteArrayOutputStream()
      repeat(answers) {
        framed.write(0)
        framed.write(ANSWER.size)
        framed.write(ANSWER)
      }
      connection = DotConnection(ByteArrayInputStream(framed.toByteArray()), written, Closeable { closed = true })
    }
  }

  private fun client(answersPerConnection: Int = 2) = DotClient(
    connect = { Fake(answersPerConnection).also { opened += it }.connection },
    now = { clock },
  )

  @Test
  fun framesEachMessageWithItsLength() {
    client().exchange(byteArrayOf(1, 2, 3))

    assertArrayEquals(byteArrayOf(0, 3, 1, 2, 3), opened.single().written.toByteArray())
  }

  @Test
  fun keepsAConnectionForTheNextQuery() {
    val client = client()
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(1)))
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(2)))

    assertEquals(1, opened.size)
  }

  @Test
  fun opensANewConnectionWhenTheKeptOneFails() {
    val client = client(answersPerConnection = 1)
    client.exchange(byteArrayOf(1))
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(2)))

    assertEquals(2, opened.size)
    assertTrue(opened[0].closed)
  }

  @Test
  fun closesAConnectionLeftIdleTooLong() {
    val client = client()
    client.exchange(byteArrayOf(1))
    clock += 21_000
    client.exchange(byteArrayOf(2))

    assertEquals(2, opened.size)
    assertTrue(opened[0].closed)
  }

  @Test
  fun closesEverythingAndRefusesQueriesOnceClosed() {
    val client = client()
    client.exchange(byteArrayOf(1))
    client.close()

    assertTrue(opened.single().closed)
    assertThrows(IOException::class.java) { client.exchange(byteArrayOf(2)) }
    assertEquals(1, opened.size)
  }

  @Test
  fun passesOnTheFailureOfANewConnection() {
    val client = client(answersPerConnection = 0)

    assertThrows(IOException::class.java) { client.exchange(byteArrayOf(1)) }
    assertTrue(opened.single().closed)
  }

  private companion object {
    val ANSWER = byteArrayOf(0x12, 0x34, 0x81.toByte(), 0x80.toByte())
  }
}

class ResolverChainTest {
  // Probes run only when a test says so, and scheduled ones when the test moves the clock.
  private class ManualBackground : Background {
    var time = 0L
    val tasks = ArrayDeque<() -> Unit>()
    val scheduled = mutableListOf<Pair<Long, () -> Unit>>()
    var stopped = false

    override fun run(task: () -> Unit) {
      tasks.addLast(task)
    }

    override fun schedule(delayMillis: Long, task: () -> Unit) {
      scheduled += time + delayMillis to task
    }

    override fun stop() {
      stopped = true
    }

    fun runAll() {
      while (tasks.isNotEmpty()) tasks.removeFirst()()
    }

    fun delays() = scheduled.map { it.first - time }

    fun advance(millis: Long) {
      time += millis
      val due = scheduled.filter { it.first <= time }
      scheduled -= due.toSet()
      due.forEach { it.second() }
      runAll()
    }
  }

  private val background = ManualBackground()

  // A resolver that answers each query with `rcode`, or fails with `failure`, on new connections
  // and kept ones alike.
  private inner class FakeResolver {
    var rcode = Dns.NOERROR
    var failure: IOException? = null
    val budgets = mutableListOf<Int?>()
    val queries = mutableListOf<ByteArray>()
    val client = DotClient({ budget -> budgets += budget; failure?.let { throw it }; connection() }, { background.time })

    val connects get() = budgets.size
    val probes get() = queries.count { Dns.parseQuery(it)?.type == Dns.TYPE_NS }

    fun asked(name: String = "example.org") = queries.count { Dns.parseQuery(it)?.name == name }

    private fun connection(): DotConnection {
      val written = ByteArrayOutputStream()
      var read = 0
      var pending = ByteArrayInputStream(ByteArray(0))
      val input = object : InputStream() {
        override fun read(): Int {
          if (pending.available() == 0) {
            failure?.let { throw it }
            val bytes = written.toByteArray()
            val query = bytes.copyOfRange(read + 2, bytes.size)
            read = bytes.size
            queries += query
            val answer = TestData.response(query, emptyList(), rcode)
            pending = ByteArrayInputStream(byteArrayOf((answer.size shr 8).toByte(), answer.size.toByte()) + answer)
          }
          return pending.read()
        }
      }
      return DotConnection(input, written, Closeable {})
    }
  }

  private val quad9 = FakeResolver()
  private val dns4eu = FakeResolver()
  private val cloudflare = FakeResolver()
  private val all = listOf(quad9, dns4eu, cloudflare)
  private val chain = ResolverChain(all.map { it.client }, background, { background.time })

  private fun rcode(answer: ByteArray) = TestData.u16(answer, 2) and 0x000f

  private fun ask(name: String = "example.org"): ByteArray {
    val query = TestData.query(name)
    return chain.exchange(query).also { assertTrue(Dns.matches(query, it)) }
  }

  private fun started(networks: Set<Long> = setOf(100L)) {
    chain.start(networks)
    background.runAll()
  }

  @Test
  fun prefersQuad9ThenDns4euThenCloudflare() {
    assertEquals(
      listOf("dns.quad9.net", "protective.joindns4.eu", "security.cloudflare-dns.com"),
      Resolvers.CHAIN.map { it.host },
    )
    started()
    ask()
    assertEquals(listOf(1, 0, 0), all.map { it.asked() })
    assertEquals(0, chain.active())

    quad9.failure = ConnectException("Connection refused")
    chain.networksChanged(setOf(101L))
    background.runAll()
    ask()
    assertEquals(listOf(1, 1, 0), all.map { it.asked() })
    assertEquals(1, chain.active())

    dns4eu.rcode = Dns.REFUSED
    chain.networksChanged(setOf(102L))
    background.runAll()
    ask()
    assertEquals(listOf(1, 1, 1), all.map { it.asked() })
    assertEquals(2, chain.active())
  }

  @Test
  fun failsOverOnEachKindOfResolverFailure() {
    val failures = listOf(
      SocketTimeoutException("connect timed out"),
      ConnectException("Connection refused"),
      SocketException("Connection reset"),
      SSLHandshakeException("handshake failed"),
      SSLPeerUnverifiedException("The certificate does not name dns.quad9.net"),
    )
    for (failure in failures) {
      val first = FakeResolver().apply { this.failure = failure }
      val second = FakeResolver()
      val chain = ResolverChain(listOf(first.client, second.client), ManualBackground(), { 0L })

      assertEquals(Dns.NOERROR, rcode(chain.exchange(TestData.query("example.org"))))
      assertEquals(1, second.asked())
    }
  }

  @Test
  fun failsOverWhenTheResolverRefusesToAnswer() {
    quad9.rcode = Dns.REFUSED

    assertEquals(Dns.NOERROR, rcode(ask()))
    assertEquals(1, dns4eu.asked())
  }

  @Test
  fun keepsServfailAndNxdomainAsTheAnswer() {
    started()
    for (final in listOf(Dns.SERVFAIL, Dns.NXDOMAIN)) {
      quad9.rcode = final

      assertEquals(final, rcode(ask()))
      assertEquals(0, dns4eu.asked() + cloudflare.asked())
      assertEquals(0, chain.active())
    }
  }

  @Test
  fun probesEveryResolverOnceInTheBackgroundWhenTheTunnelStarts() {
    chain.start(setOf(100L, 200L))

    assertEquals(listOf(0, 0, 0), all.map { it.connects })
    assertEquals(3, background.tasks.size)
    // The network callback first reports the networks already there.
    chain.networksChanged(setOf(100L, 200L))
    assertEquals(3, background.tasks.size)
    background.runAll()
    assertEquals(listOf(1, 1, 1), all.map { it.probes })
  }

  @Test
  fun startsNoSecondProbeWhileOneRunsOnTheSameNetwork() {
    quad9.failure = SocketTimeoutException("connect timed out")
    chain.start(setOf(100L))
    assertEquals(3, background.tasks.size)

    // A query that fails on Quad9 before its probe ran asks for one more, which is already running.
    ask()
    assertEquals(3, background.tasks.size)
    background.runAll()
    assertEquals(2, quad9.connects)
  }

  @Test
  fun probesTheChainAgainInTheBackgroundOnANetworkChange() {
    quad9.failure = ConnectException("Connection refused")
    started()
    quad9.failure = null

    chain.networksChanged(setOf(200L))
    assertEquals(1, quad9.connects)
    background.runAll()
    assertEquals(2, quad9.connects)
    ask()
    assertEquals(1, quad9.asked())
  }

  @Test
  fun ignoresAProbeThatStartedOnThePreviousNetwork() {
    quad9.failure = ConnectException("Network is unreachable")
    chain.start(setOf(100L))
    chain.networksChanged(setOf(200L))
    quad9.failure = null
    background.runAll()

    ask()
    assertEquals(1, quad9.asked())
  }

  @Test
  fun probesAResolverAtOnceWhenAQueryFailsOnIt() {
    started()
    quad9.failure = SocketException("Connection reset")

    ask()
    assertEquals(1, dns4eu.asked())
    assertEquals(1, background.tasks.size)
    quad9.failure = null
    background.runAll()
    assertEquals(0, chain.active())

    ask()
    assertEquals(1, quad9.asked())
    assertTrue(background.scheduled.isEmpty())
  }

  @Test
  fun probesAFailingResolverAfter30Seconds2And10MinutesThenEveryHour() {
    started()
    quad9.failure = SocketTimeoutException("connect timed out")
    ask()
    background.runAll()

    assertEquals(listOf(30_000L), background.delays())
    for (delay in listOf(30_000L, 120_000L, 600_000L, 3_600_000L)) {
      val probes = quad9.connects
      background.advance(delay - 1)
      assertEquals(probes, quad9.connects)
      background.advance(1)
      assertEquals(probes + 1, quad9.connects)
    }
    assertEquals(listOf(3_600_000L), background.delays())

    quad9.failure = null
    background.advance(3_600_000L)
    assertEquals(0, chain.active())
    assertTrue(background.scheduled.isEmpty())
    ask()
    assertEquals(1, quad9.asked())
  }

  @Test
  fun startsTheWaitsOverOnANetworkChange() {
    quad9.failure = SocketTimeoutException("connect timed out")
    started()
    background.advance(30_000L)
    assertEquals(listOf(120_000L), background.delays())

    chain.networksChanged(setOf(200L))
    background.runAll()
    // The plan of the previous network no longer probes.
    val probes = quad9.connects
    background.advance(30_000L)
    assertEquals(probes + 1, quad9.connects)
    background.advance(90_000L)
    assertEquals(probes + 1, quad9.connects)
  }

  @Test
  fun neverSendsAQueryToAResolverMarkedFailing() {
    quad9.failure = SocketTimeoutException("connect timed out")
    started()
    val probed = quad9.connects

    repeat(5) { ask() }
    assertEquals(probed, quad9.connects)
    assertEquals(5, dns4eu.asked())
  }

  @Test
  fun triesTheChainInOrderWithAShortTimeoutBeforeAnyProbeFinished() {
    quad9.failure = SocketTimeoutException("connect timed out")
    chain.start(setOf(100L))

    ask()
    assertEquals(listOf<Int?>(1_000), quad9.budgets)
    assertEquals(listOf<Int?>(1_000), dns4eu.budgets)
    assertEquals(0, cloudflare.connects)
  }

  @Test
  fun answersServfailWithoutAnyOtherResolverWhenTheWholeChainFails() {
    for (resolver in all) resolver.failure = ConnectException("Connection refused")
    val processor = QueryProcessor(FilterPolicy(TestData.lists, FilterConfig()), chain)
    val query = TestData.query("example.org")

    val answer = processor.answer(query, overUdp = true)!!
    assertEquals(Dns.SERVFAIL, rcode(answer))
    assertTrue(Dns.matches(query, answer))
    assertEquals(listOf(1, 1, 1), all.map { it.connects })
    assertEquals(null, chain.active())
  }

  @Test
  fun answersAtOnceAndProbesAgainInTheBackgroundOnceEveryResolverFailed() {
    for (resolver in all) resolver.failure = ConnectException("Connection refused")
    started()
    for (resolver in all) resolver.failure = null

    assertThrows(IOException::class.java) { ask() }
    assertEquals(listOf(1, 1, 1), all.map { it.connects })
    background.runAll()
    assertEquals(listOf(2, 2, 2), all.map { it.connects })
    ask()
  }

  @Test
  fun stopsItsProbesAndClosesItsConnections() {
    started()
    chain.stop()

    assertTrue(background.stopped)
    assertThrows(IOException::class.java) { quad9.client.exchange(TestData.query("example.org")) }
  }
}
