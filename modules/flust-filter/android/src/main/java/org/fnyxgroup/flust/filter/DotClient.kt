package org.fnyxgroup.flust.filter

import java.io.Closeable
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.InterruptedIOException
import java.io.OutputStream
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit
import kotlin.random.Random

// One TLS connection to the resolver. DNS over TLS frames each message with its length
// (RFC 7858). A connection carries one query at a time. `readTimeout` sets how long a read may
// wait, since a kept connection serves probes and queries, which have different budgets.
class DotConnection(
  input: InputStream,
  output: OutputStream,
  private val closeable: Closeable,
  private val readTimeout: (Int) -> Unit = {},
) : Closeable {
  private val input = DataInputStream(input)
  private val output = DataOutputStream(output)
  var lastUsed = 0L

  fun exchange(query: ByteArray, readMillis: Int? = null): ByteArray {
    if (query.size > 0xffff) throw IOException("The query is too long")
    readMillis?.let(readTimeout)
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
// idle fails on its next query, which then goes once more over a new connection. A timeout
// (InterruptedIOException, which SocketTimeoutException extends) does not: the resolver is too
// slow, and the chain moves on. `closeTransport` ends the sockets still
// connecting when the client closes.
class DotClient(
  private val connect: (Timeouts) -> DotConnection,
  private val now: () -> Long,
  private val closeTransport: () -> Unit = {},
  private val maxIdle: Int = 4,
  private val idleMillis: Long = 20_000,
) {
  private val idle = ArrayDeque<DotConnection>()
  private val busy = mutableSetOf<DotConnection>()
  private var closed = false

  fun exchange(query: ByteArray, timeouts: Timeouts): ByteArray {
    take()?.let { reused ->
      try {
        return reused.exchange(query, timeouts.readMillis).also { release(reused) }
      } catch (error: Exception) {
        discard(reused)
        if (error !is IOException || error is InterruptedIOException) throw error
      }
    }
    if (isClosed()) throw IOException("The filter has stopped")
    val fresh = connect(timeouts)
    if (!adopt(fresh)) {
      fresh.close()
      throw IOException("The filter has stopped")
    }
    try {
      return fresh.exchange(query, timeouts.readMillis).also { release(fresh) }
    } catch (error: Exception) {
      discard(fresh)
      throw error
    }
  }

  // Closes the kept connections, those in use and those being opened.
  fun close() {
    val connections = synchronized(this) {
      closed = true
      (idle + busy).also {
        idle.clear()
        busy.clear()
      }
    }
    connections.forEach(DotConnection::close)
    closeTransport()
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
      found?.also { busy += it }
    }
    stale.forEach(DotConnection::close)
    return connection
  }

  private fun adopt(connection: DotConnection): Boolean = synchronized(this) { !closed && busy.add(connection) }

  private fun release(connection: DotConnection) {
    connection.lastUsed = now()
    val kept = synchronized(this) {
      busy -= connection
      !closed && idle.size < maxIdle && idle.add(connection)
    }
    if (!kept) connection.close()
  }

  private fun discard(connection: DotConnection) {
    synchronized(this) { busy -= connection }
    connection.close()
  }
}

// Where the chain runs its probes, away from the queries. Production runs them on a few threads
// of their own; the tests run them by hand.
interface Background {
  fun run(task: () -> Unit)

  fun schedule(delayMillis: Long, task: () -> Unit)

  fun stop()
}

// A task handed in after stop() is dropped: the network callback or a query may still reach the
// chain while the tunnel closes, and an exception there would end the process.
class BackgroundThreads(threads: Int) : Background {
  private val executor: ScheduledExecutorService = ScheduledThreadPoolExecutor(threads) { task ->
    Thread(task, "flust-filter-probe").apply { isDaemon = true }
  }

  override fun run(task: () -> Unit) {
    try {
      executor.execute(task)
    } catch (stopped: RejectedExecutionException) {
    }
  }

  override fun schedule(delayMillis: Long, task: () -> Unit) {
    try {
      executor.schedule(task, delayMillis, TimeUnit.MILLISECONDS)
    } catch (stopped: RejectedExecutionException) {
    }
  }

  override fun stop() {
    executor.shutdownNow()
  }
}

// The resolvers in the order flust prefers them (Resolvers.CHAIN, docs/decisions/0045-resolver-chain.md).
// Probes in the background tell which ones answer, and a query goes to the first that passed, so
// it never waits on one known to fail. A resolver fails a query on any error, a timeout of the
// short query budgets included, or on REFUSED: it will not answer this phone. SERVFAIL, NXDOMAIN
// and every other answer are the answer, but a SERVFAIL also probes the resolver, so that one
// that answers everything with errors is found out. When every resolver failed, the query fails
// and gets SERVFAIL: there is no other way out, plain DNS included.
class ResolverChain(
  private val resolvers: List<DotClient>,
  private val background: Background,
  private val now: () -> Long,
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

  // What passed or failed on the previous network says nothing of this one: every resolver is
  // unknown again until its probe ends, a probe that started before no longer counts, and the
  // waits start over.
  fun networksChanged(networks: Set<Long>) {
    val changed = synchronized(this) {
      (networks != this.networks).also {
        if (it) {
          this.networks = networks
          network++
          states.forEach { resolver ->
            resolver.state = State.UNKNOWN
            resolver.failures = 0
          }
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

  // The resolvers that passed, in order, then the ones not probed yet, in order, all with the
  // short query budgets. Never one that failed.
  override fun exchange(query: ByteArray): ByteArray {
    val order = synchronized(this) {
      resolvers.indices.filter { states[it].state == State.PASSED } +
        resolvers.indices.filter { states[it].state == State.UNKNOWN }
    }
    for (index in order) {
      val answer = ask(index, query, Timeouts.QUERY)
      if (answer != null) {
        if (rcode(answer) == Dns.SERVFAIL) probeNow(index)
        return answer
      }
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

  // Null when the resolver failed, whatever the error: an unchecked exception from the TLS stack
  // counts as a failure like any other, rather than ending the query or the probe.
  private fun ask(index: Int, query: ByteArray, timeouts: Timeouts): ByteArray? =
    try {
      resolvers[index].exchange(query, timeouts).takeUnless { rcode(it) == Dns.REFUSED }
    } catch (failed: Exception) {
      null
    }

  // A probe asks for the root's name servers, which every working resolver knows: it passes on
  // NOERROR with at least one NS record, and fails on anything else, SERVFAIL, NXDOMAIN, REFUSED
  // or an empty answer included.
  private fun probeNow(index: Int) {
    val started = synchronized(this) {
      val resolver = states[index]
      if (resolver.probing == network) return
      resolver.probing = network
      resolver.plan++
      network
    }
    background.run {
      var passed = false
      try {
        val query = Dns.query(Random.nextInt(0x10000), ".", Dns.TYPE_NS)
        val answer = ask(index, query, Timeouts.PROBE)
        passed = answer != null && !Dns.records(answer, query, Dns.TYPE_NS).isNullOrEmpty()
      } catch (failed: Exception) {
        passed = false
      } finally {
        probed(index, passed, started)
      }
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

  private fun rcode(answer: ByteArray): Int? =
    if (answer.size >= Dns.HEADER_BYTES) Dns.u16(answer, 2) and 0x000f else null

  private companion object {
    val RETRY_DELAYS = listOf(30_000L, 120_000L, 600_000L)
    const val HOUR = 3_600_000L
  }
}
