package org.fnyxgroup.flust.filter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import kotlin.concurrent.thread

class DotClientTest {
  private var clock = 0L
  private val opened = mutableListOf<Fake>()
  private var transportClosed = false

  private inner class Fake(answers: Int) {
    val written = ByteArrayOutputStream()
    var closed = false
    val readBudgets = mutableListOf<Int>()
    val connection: DotConnection

    init {
      val framed = ByteArrayOutputStream()
      repeat(answers) {
        framed.write(0)
        framed.write(ANSWER.size)
        framed.write(ANSWER)
      }
      connection = DotConnection(
        ByteArrayInputStream(framed.toByteArray()),
        written,
        Closeable { closed = true },
        readTimeout = { readBudgets += it },
      )
    }
  }

  private fun client(answersPerConnection: Int = 2) = DotClient(
    connect = { Fake(answersPerConnection).also { opened += it }.connection },
    now = { clock },
    closeTransport = { transportClosed = true },
  )

  @Test
  fun framesEachMessageWithItsLength() {
    client().exchange(byteArrayOf(1, 2, 3), Timeouts.QUERY)

    assertArrayEquals(byteArrayOf(0, 3, 1, 2, 3), opened.single().written.toByteArray())
  }

  @Test
  fun keepsAConnectionForTheNextQuery() {
    val client = client()
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(1), Timeouts.QUERY))
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(2), Timeouts.QUERY))

    assertEquals(1, opened.size)
  }

  // A connection a probe opened serves the next query, which must not wait as long as the probe.
  @Test
  fun givesEachExchangeTheReadBudgetOfItsCaller() {
    val client = client()
    client.exchange(byteArrayOf(1), Timeouts.PROBE)
    client.exchange(byteArrayOf(2), Timeouts.QUERY)

    assertEquals(listOf(Timeouts.PROBE.readMillis, Timeouts.QUERY.readMillis), opened.single().readBudgets)
  }

  @Test
  fun opensANewConnectionWhenTheKeptOneFails() {
    val client = client(answersPerConnection = 1)
    client.exchange(byteArrayOf(1), Timeouts.QUERY)
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(2), Timeouts.QUERY))

    assertEquals(2, opened.size)
    assertTrue(opened[0].closed)
  }

  // The resolver is too slow: a second connection would double the wait before the chain moves on.
  @Test
  fun doesNotRetryAKeptConnectionThatTimedOut() {
    var timesOut = false
    var connects = 0
    val client = DotClient(
      connect = {
        connects++
        DotConnection(
          object : InputStream() {
            override fun read(): Int = if (timesOut) throw SocketTimeoutException("Read timed out") else 0
          },
          ByteArrayOutputStream(),
          Closeable {},
        )
      },
      now = { clock },
    )
    client.exchange(byteArrayOf(1), Timeouts.QUERY)
    timesOut = true

    assertThrows(SocketTimeoutException::class.java) { client.exchange(byteArrayOf(2), Timeouts.QUERY) }
    assertEquals(1, connects)
  }

  @Test
  fun closesAConnectionLeftIdleTooLong() {
    val client = client()
    client.exchange(byteArrayOf(1), Timeouts.QUERY)
    clock += 21_000
    client.exchange(byteArrayOf(2), Timeouts.QUERY)

    assertEquals(2, opened.size)
    assertTrue(opened[0].closed)
  }

  @Test
  fun closesEverythingAndRefusesQueriesOnceClosed() {
    val client = client()
    client.exchange(byteArrayOf(1), Timeouts.QUERY)
    client.close()

    assertTrue(opened.single().closed)
    assertTrue(transportClosed)
    assertThrows(IOException::class.java) { client.exchange(byteArrayOf(2), Timeouts.QUERY) }
    assertEquals(1, opened.size)
  }

  // A query or a probe waiting on its answer when the filter stops ends at once, not when its
  // read times out.
  @Test
  fun closesAConnectionInUse() {
    val waiting = CountDownLatch(1)
    val unblocked = CountDownLatch(1)
    var closed = false
    val client = DotClient(
      connect = {
        DotConnection(
          object : InputStream() {
            override fun read(): Int {
              waiting.countDown()
              unblocked.await(5, TimeUnit.SECONDS)
              throw SocketException("Socket closed")
            }
          },
          ByteArrayOutputStream(),
          Closeable {
            closed = true
            unblocked.countDown()
          },
        )
      },
      now = { clock },
    )
    var failure: Exception? = null
    val query = thread {
      failure = try {
        client.exchange(byteArrayOf(1), Timeouts.PROBE)
        null
      } catch (error: Exception) {
        error
      }
    }
    assertTrue(waiting.await(5, TimeUnit.SECONDS))

    client.close()
    query.join(5_000)
    assertTrue(closed)
    assertTrue(failure is IOException)
  }

  // The filter stopped while the connection was being opened.
  @Test
  fun closesAConnectionThatOpensAfterTheClientClosed() {
    lateinit var client: DotClient
    client = DotClient(
      connect = {
        client.close()
        Fake(1).also { opened += it }.connection
      },
      now = { clock },
    )

    assertThrows(IOException::class.java) { client.exchange(byteArrayOf(1), Timeouts.QUERY) }
    assertTrue(opened.single().closed)
  }

  @Test
  fun passesOnTheFailureOfANewConnection() {
    val client = client(answersPerConnection = 0)

    assertThrows(IOException::class.java) { client.exchange(byteArrayOf(1), Timeouts.QUERY) }
    assertTrue(opened.single().closed)
  }

  private companion object {
    val ANSWER = byteArrayOf(0x12, 0x34, 0x81.toByte(), 0x80.toByte())
  }
}

class BackgroundThreadsTest {
  // The network callback can reach a chain whose threads already stopped.
  @Test
  fun dropsTasksHandedInAfterStop() {
    val background = BackgroundThreads(1)
    background.stop()

    background.run { throw AssertionError("ran after stop") }
    background.schedule(0) { throw AssertionError("ran after stop") }
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

  // A resolver that answers each query with `rcode`, and each probe with `probeRcode` and the
  // root's name servers unless `rootServers` is false. `failure` is thrown on connect and on every
  // read, `readFailure` on reads only, so a kept connection fails as a slow resolver's would.
  private inner class FakeResolver {
    var rcode = Dns.NOERROR
    var probeRcode: Int? = null
    var rootServers = true
    var failure: Exception? = null
    var readFailure: IOException? = null
    var transportClosed = false
    val timeouts = mutableListOf<Timeouts>()
    val readBudgets = mutableListOf<Int>()
    val queries = mutableListOf<ByteArray>()
    val connections = mutableListOf<Closed>()
    val client = DotClient(
      { budgets -> timeouts += budgets; failure?.let { throw it }; connection() },
      { background.time },
      closeTransport = { transportClosed = true },
    )

    val connects get() = timeouts.size
    val probes get() = queries.count { Dns.parseQuery(it)?.type == Dns.TYPE_NS }

    fun asked(name: String = "example.org") = queries.count { Dns.parseQuery(it)?.name == name }

    private fun answer(query: ByteArray): ByteArray {
      if (Dns.parseQuery(query)?.type != Dns.TYPE_NS) return TestData.response(query, emptyList(), rcode)
      val code = probeRcode ?: rcode
      val servers = if (rootServers && code == Dns.NOERROR) listOf(Triple(Dns.TYPE_NS, 86_400L, ROOT_SERVER)) else emptyList()
      return TestData.response(query, servers, code)
    }

    private fun connection(): DotConnection {
      val written = ByteArrayOutputStream()
      var read = 0
      var pending = ByteArrayInputStream(ByteArray(0))
      val input = object : InputStream() {
        override fun read(): Int {
          if (pending.available() == 0) {
            failure?.let { throw it }
            readFailure?.let { throw it }
            val bytes = written.toByteArray()
            val query = bytes.copyOfRange(read + 2, bytes.size)
            read = bytes.size
            queries += query
            val answer = answer(query)
            pending = ByteArrayInputStream(byteArrayOf((answer.size shr 8).toByte(), answer.size.toByte()) + answer)
          }
          return pending.read()
        }
      }
      val closed = Closed()
      connections += closed
      return DotConnection(input, written, closed, readTimeout = { readBudgets += it })
    }
  }

  private class Closed : Closeable {
    var closed = false

    override fun close() {
      closed = true
    }
  }

  private val quad9 = FakeResolver()
  private val cloudflare = FakeResolver()
  private val dns4eu = FakeResolver()
  private val all = listOf(quad9, cloudflare, dns4eu)
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
  fun prefersQuad9ThenCloudflareThenDns4eu() {
    assertEquals(
      listOf("dns.quad9.net", "security.cloudflare-dns.com", "protective.joindns4.eu"),
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

    cloudflare.rcode = Dns.REFUSED
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
      IllegalStateException("An unchecked failure of the TLS stack"),
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
    assertEquals(1, cloudflare.asked())
  }

  @Test
  fun keepsServfailAndNxdomainAsTheAnswer() {
    started()
    for (final in listOf(Dns.SERVFAIL, Dns.NXDOMAIN)) {
      quad9.rcode = final
      quad9.probeRcode = Dns.NOERROR

      assertEquals(final, rcode(ask()))
      assertEquals(0, cloudflare.asked() + dns4eu.asked())
      background.runAll()
      assertEquals(0, chain.active())
    }
  }

  // A probe passes only on the root's name servers: a resolver that answers it with an error or
  // with nothing would answer the person's lookups no better.
  @Test
  fun failsAProbeThatGetsNoRootServers() {
    val answers = listOf<FakeResolver.() -> Unit>(
      { rcode = Dns.SERVFAIL },
      { rcode = Dns.NXDOMAIN },
      { rcode = Dns.REFUSED },
      { rootServers = false },
    )
    for (answer in answers) {
      val background = ManualBackground()
      val first = FakeResolver().apply(answer)
      val second = FakeResolver()
      val chain = ResolverChain(listOf(first.client, second.client), background, { 0L })
      chain.start(setOf(100L))
      background.runAll()

      assertEquals(1, first.probes)
      assertEquals(1, chain.active())
      chain.exchange(TestData.query("example.org"))
      assertEquals(0, first.asked())
      assertEquals(1, second.asked())
    }
  }

  @Test
  fun probesTheActiveResolverWhenItAnswersServfail() {
    started()
    quad9.rcode = Dns.SERVFAIL
    quad9.probeRcode = Dns.NOERROR

    assertEquals(Dns.SERVFAIL, rcode(ask()))
    assertEquals(1, background.tasks.size)
    background.runAll()
    assertEquals(2, quad9.probes)
    assertEquals(0, chain.active())
  }

  // How Quad9 will stop answering in France is not known: SERVFAIL to everything must not keep it
  // first in the chain.
  @Test
  fun movesOnFromAResolverThatAnswersServfailToEverything() {
    started()
    quad9.rcode = Dns.SERVFAIL

    assertEquals(Dns.SERVFAIL, rcode(ask()))
    assertEquals(0, cloudflare.asked())
    background.runAll()
    assertEquals(1, chain.active())

    assertEquals(Dns.NOERROR, rcode(ask()))
    assertEquals(1, cloudflare.asked())
    assertEquals(listOf(30_000L), background.delays())
  }

  // The resolver passed its probe, then stops answering: the query waits for the short read budget
  // only, on the kept connection only, then goes on to the next resolver.
  @Test
  fun movesOnWhenAResolverThatPassedTimesOut() {
    started()
    quad9.readFailure = SocketTimeoutException("Read timed out")

    assertEquals(Dns.NOERROR, rcode(ask()))
    assertEquals(Timeouts.QUERY.readMillis, quad9.readBudgets.last())
    assertEquals(1, quad9.connects)
    assertEquals(1, cloudflare.asked())
    assertEquals(1, chain.active())
  }

  @Test
  fun givesQueriesTheShortBudgetsAndProbesTheLongOnes() {
    chain.start(setOf(100L))
    ask()
    assertEquals(listOf(Timeouts.QUERY), quad9.timeouts)

    background.runAll()
    assertEquals(listOf(Timeouts.QUERY.readMillis, Timeouts.PROBE.readMillis), quad9.readBudgets)
    assertEquals(listOf(Timeouts.PROBE), cloudflare.timeouts)
    assertEquals(1_000, Timeouts.QUERY.connectMillis)
    assertEquals(2_000, Timeouts.QUERY.handshakeMillis)
    assertEquals(3_000, Timeouts.QUERY.readMillis)
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

  // A resolver that failed on the previous network may answer on this one, and one that passed
  // may not: until the probes end, queries try the whole chain in order with the short budgets.
  @Test
  fun treatsEveryResolverAsNotProbedYetAfterANetworkChange() {
    quad9.failure = ConnectException("Network is unreachable")
    started()
    assertEquals(1, chain.active())
    quad9.failure = null

    chain.networksChanged(setOf(200L))
    assertNull(chain.active())
    ask()
    assertEquals(1, quad9.asked())
    assertEquals(Timeouts.QUERY, quad9.timeouts.last())
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
    assertEquals(1, cloudflare.asked())
    assertEquals(1, background.tasks.size)
    quad9.failure = null
    background.runAll()
    assertEquals(0, chain.active())

    ask()
    assertEquals(1, quad9.asked())
    assertTrue(background.scheduled.isEmpty())
  }

  // An unchecked exception in a probe fails it like any other error, and the next probes still run.
  @Test
  fun keepsProbingAfterAnUncheckedFailure() {
    quad9.failure = IllegalStateException("An unchecked failure of the TLS stack")
    started()

    assertEquals(1, chain.active())
    assertEquals(listOf(30_000L), background.delays())
    background.advance(30_000L)
    assertEquals(2, quad9.connects)

    quad9.failure = null
    background.advance(120_000L)
    assertEquals(0, chain.active())
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
    assertEquals(5, cloudflare.asked())
  }

  @Test
  fun triesTheChainInOrderBeforeAnyProbeFinished() {
    quad9.failure = SocketTimeoutException("connect timed out")
    chain.start(setOf(100L))

    ask()
    assertEquals(listOf(Timeouts.QUERY), quad9.timeouts)
    assertEquals(listOf(Timeouts.QUERY), cloudflare.timeouts)
    assertEquals(0, dns4eu.connects)
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
    ask()
    val connections = all.flatMap { it.connections }
    assertEquals(3, connections.size)
    assertFalse(connections.any { it.closed })

    chain.stop()

    assertTrue(background.stopped)
    assertTrue(connections.all { it.closed })
    assertTrue(all.all { it.transportClosed })
    assertThrows(IOException::class.java) { quad9.client.exchange(TestData.query("example.org"), Timeouts.QUERY) }
  }

  private companion object {
    // a.root-servers.net, as a name in wire format.
    val ROOT_SERVER = byteArrayOf(1, 'a'.code.toByte(), 12) + "root-servers".toByteArray() + byteArrayOf(3) + "net".toByteArray() + byteArrayOf(0)
  }
}

class FilterListsTest {
  @Test
  fun readsTheListsOnceAndSharesThem() {
    var reads = 0
    val lists = FilterLists { reads++; TestData.lists }

    assertFalse(lists.cached)
    lists.get()
    lists.get()
    assertTrue(lists.cached)
    assertEquals(1, reads)
  }

  // A start still being prepared when the service stops must not keep 2.7 MB in a process whose
  // service is gone.
  @Test
  fun keepsNothingReadAfterRelease() {
    var reads = 0
    val lists = FilterLists { reads++; TestData.lists }
    lists.get()
    lists.release()

    assertFalse(lists.cached)
    assertTrue(lists.get() === TestData.lists)
    assertFalse(lists.cached)
    assertEquals(2, reads)
  }
}
