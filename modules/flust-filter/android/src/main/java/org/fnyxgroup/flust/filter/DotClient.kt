package org.fnyxgroup.flust.filter

import java.io.Closeable
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

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

// Queries the resolver over a few kept-alive connections. A connection the resolver closed while
// idle fails on its next query, which then goes once more over a new connection.
class DotClient(
  private val connect: () -> DotConnection,
  private val now: () -> Long,
  private val maxIdle: Int = 4,
  private val idleMillis: Long = 20_000,
) : Upstream {
  private val idle = ArrayDeque<DotConnection>()
  private var closed = false

  override fun exchange(query: ByteArray): ByteArray {
    take()?.let { reused ->
      try {
        return reused.exchange(query).also { release(reused) }
      } catch (error: IOException) {
        reused.close()
      }
    }
    if (isClosed()) throw IOException("The filter has stopped")
    val fresh = connect()
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
