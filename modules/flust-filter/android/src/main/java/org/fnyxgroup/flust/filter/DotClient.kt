package org.fnyxgroup.flust.filter

import java.io.Closeable
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit
import kotlin.random.Random

// One TLS connection to the resolver. DNS over TLS frames each message with its length
// (RFC 7858). A connection carries one query at a time.
class DotConnection(input: InputStream, output: OutputStream, private val closeable: Closeable) : Closeable {
  private val input = DataInputStream(input)
  private val output = DataOutputStream(output)
  var lastUsed = 0L

  fun exchange(query: ByteArray): ByteArray {
    if (query.size > 0xffff) throw IOException("The query is too long")
    output.writeShort(query.size)
    output.write(query)
    output.flush()
    val answer = ByteArray(input.readUnsignedShort())
    input.readFully(answer)
    return answer
  }

  override fun close() {
    try {
      closeable.close()
    } catch (ignored: IOException) {
    }
  }
}

// Queries one resolver over a few kept-alive connections. A connection the resolver closed while
// idle fails on its next query, which then goes once more over a new connection. `connect` takes a
// connect budget in milliseconds, or null for the transport's own.
class DotClient(
  private val connect: (Int?) -> DotConnection,
  private val now: () -> Long,
  private val maxIdle: Int = 4,
  private val idleMillis: Long = 20_000,
) : Upstream {
  private val idle = ArrayDeque<DotConnection>()
  private var closed = false

  override fun exchange(query: ByteArray): ByteArray = exchange(query, null)

  fun exchange(query: ByteArray, connectBudgetMillis: Int?): ByteArray {
    take()?.let { reused ->
      try {
        return reused.exchange(query).also { release(reused) }
      } catch (error: IOException) {
        reused.close()
      }
    }
    if (isClosed()) throw IOException("The filter has stopped")
    val fresh = connect(connectBudgetMillis)
    try {
      return fresh.exchange(query).also { release(fresh) }
    } catch (error: IOException) {
      fresh.close()
      throw error
    }
  }

  fun close() {
    val connections = synchronized(this) {
      closed = true
      idle.toList().also { idle.clear() }
    }
    connections.forEach(DotConnection::close)
  }

  // After a change of network the kept connections run over the old one.
  fun closeIdle() {
    val connections = synchronized(this) { idle.toList().also { idle.clear() } }
    connections.forEach(DotConnection::close)
  }

  private fun isClosed() = synchronized(this) { closed }

  private fun take(): DotConnection? {
    val stale = mutableListOf<DotConnection>()
    val connection = synchronized(this) {
      var found: DotConnection? = null
      while (found == null && idle.isNotEmpty()) {
        val candidate = idle.removeLast()
        if (now() - candidate.lastUsed > idleMillis) stale += candidate else found = candidate
      }
      found
    }
    stale.forEach(DotConnection::close)
    return connection
  }

  private fun release(connection: DotConnection) {
    connection.lastUsed = now()
    val kept = synchronized(this) { !closed && idle.size < maxIdle && idle.add(connection) }
    if (!kept) connection.close()
  }
}

// Where the chain runs its probes, away from the queries. Production runs them on a few threads
// of their own; the tests run them by hand.
interface Background {
  fun run(task: () -> Unit)

  fun schedule(delayMillis: Long, task: () -> Unit)

  fun stop()
}

class BackgroundThreads(threads: Int) : Background {
  private val executor: ScheduledExecutorService = ScheduledThreadPoolExecutor(threads) { task ->
    Thread(task, "flust-filter-probe").apply { isDaemon = true }
  }

  override fun run(task: () -> Unit) {
    if (!executor.isShutdown) executor.execute(task)
  }

  override fun schedule(delayMillis: Long, task: () -> Unit) {
    if (!executor.isShutdown) executor.schedule(task, delayMillis, TimeUnit.MILLISECONDS)
  }

  override fun stop() {
    executor.shutdownNow()
  }
}

// The resolvers in the order flust prefers them (Resolvers.CHAIN, docs/decisions/0045-resolver-chain.md).
// Probes in the background tell which ones answer, and a query goes to the first that passed, so
// it never waits on one known to fail. A resolver fails on any I/O or TLS error, or on REFUSED: it
// will not answer this phone. SERVFAIL, NXDOMAIN and every other answer are the answer. When every
// resolver failed, the query fails and gets SERVFAIL: there is no other way out, plain DNS
// included.
class ResolverChain(
  private val resolvers: List<DotClient>,
  private val background: Background,
  private val now: () -> Long,
  private val firstConnectMillis: Int = 1_000,
  private val retryMillis: Long = 30_000,
) : Upstream {
  private enum class State { UNKNOWN, PASSED, FAILED }

  private class Resolver {
    var state = State.UNKNOWN
    // The network a probe is running on, so that a second one does not start beside it.
    var probing: Int? = null
    // Probes failed in a row, which set the wait before the next one.
    var failures = 0
    // Bumped by every newer plan, so that an older scheduled probe does nothing.
    var plan = 0
  }

  private val states = List(resolvers.size) { Resolver() }
  private var network = 0
  private var networks: Set<Long>? = null
  private var lastRetry: Long? = null

  // Probes every resolver. `networks` are the phone's networks as the tunnel starts, so that the
  // network callback reporting them again does not count as a change.
  fun start(networks: Set<Long>? = null) {
    synchronized(this) { this.networks = networks }
    resolvers.indices.forEach(::probeNow)
  }

  // A probe that started on the previous network no longer counts, and the waits start over.
  fun networksChanged(networks: Set<Long>) {
    val changed = synchronized(this) {
      (networks != this.networks).also {
        if (it) {
          this.networks = networks
          network++
          states.forEach { resolver -> resolver.failures = 0 }
        }
      }
    }
    if (!changed) return
    background.run { resolvers.forEach(DotClient::closeIdle) }
    resolvers.indices.forEach(::probeNow)
  }

  fun stop() {
    background.stop()
    resolvers.forEach(DotClient::close)
  }

  // The index of the resolver queries go to first, or null when none passed a probe.
  fun active(): Int? = synchronized(this) { states.indexOfFirst { it.state == State.PASSED }.takeIf { it >= 0 } }

  // The resolvers that passed, in order, then the ones not probed yet, in order, each with a short
  // connect timeout: a query should not wait long on a resolver that may not answer. Never one
  // that failed.
  override fun exchange(query: ByteArray): ByteArray {
    val (passed, unknown) = synchronized(this) {
      resolvers.indices.filter { states[it].state == State.PASSED } to
        resolvers.indices.filter { states[it].state == State.UNKNOWN }
    }
    for ((index, budget) in passed.map { it to null } + unknown.map { it to firstConnectMillis }) {
      val answer = ask(index, query, budget)
      if (answer != null) return answer
      failedQuery(index)
    }
    retryAll()
    throw IOException("No resolver answers")
  }

  // One failed query takes the resolver out of the order only until a probe passes again: the
  // first one starts at once.
  private fun failedQuery(index: Int) {
    synchronized(this) {
      val resolver = states[index]
      resolver.state = State.FAILED
      resolver.failures = 0
    }
    probeNow(index)
  }

  // Every resolver failed: a short outage would otherwise leave the filter without DNS until the
  // next planned probes. The query that found it does not wait.
  private fun retryAll() {
    val due = synchronized(this) {
      val last = lastRetry
      (last == null || now() - last >= retryMillis).also { if (it) lastRetry = now() }
    }
    if (due) resolvers.indices.forEach(::probeNow)
  }

  private fun ask(index: Int, query: ByteArray, connectBudgetMillis: Int?): ByteArray? =
    try {
      resolvers[index].exchange(query, connectBudgetMillis).takeUnless { refused(it) }
    } catch (failed: IOException) {
      null
    }

  private fun probeNow(index: Int) {
    val started = synchronized(this) {
      val resolver = states[index]
      if (resolver.probing == network) return
      resolver.probing = network
      resolver.plan++
      network
    }
    background.run {
      val query = Dns.query(Random.nextInt(0x10000), ".", Dns.TYPE_NS)
      val answer = ask(index, query, null)
      probed(index, answer != null && Dns.matches(query, answer), started)
    }
  }

  // A failed probe plans the next one: after 30 s, 2 min and 10 min, then every hour.
  private fun probed(index: Int, passed: Boolean, started: Int) {
    val next = synchronized(this) {
      val resolver = states[index]
      if (resolver.probing == started) resolver.probing = null
      if (started != network) return
      if (passed) {
        resolver.state = State.PASSED
        resolver.failures = 0
        return
      }
      resolver.state = State.FAILED
      val delay = RETRY_DELAYS.getOrElse(resolver.failures) { HOUR }
      resolver.failures++
      delay to ++resolver.plan
    }
    background.schedule(next.first) {
      if (synchronized(this) { states[index].plan == next.second }) probeNow(index)
    }
  }

  private fun refused(answer: ByteArray) =
    answer.size >= Dns.HEADER_BYTES && Dns.u16(answer, 2) and 0x000f == Dns.REFUSED

  private companion object {
    val RETRY_DELAYS = listOf(30_000L, 120_000L, 600_000L)
    const val HOUR = 3_600_000L
  }
}
