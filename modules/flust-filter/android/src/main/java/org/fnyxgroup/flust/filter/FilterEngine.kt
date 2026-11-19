package org.fnyxgroup.flust.filter

import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import kotlin.random.Random

// The tunnel's work, apart from Android: one thread reads packets, a few workers answer queries,
// and every answer is written back as one packet. Runs until the tunnel is closed or stop() is
// called.
class FilterEngine(
  private val lists: Blocklist,
  config: FilterConfig,
  upstream: Upstream,
  private val closeUpstream: () -> Unit,
  private val now: () -> Long = System::currentTimeMillis,
) {
  private val queries = QueryProcessor(FilterPolicy(lists, config), upstream)
  private val workers = ThreadPoolExecutor(
    WORKERS,
    WORKERS,
    30,
    TimeUnit.SECONDS,
    ArrayBlockingQueue(QUEUE),
  ).apply { allowCoreThreadTimeOut(true) }

  fun update(config: FilterConfig) = queries.update(FilterPolicy(lists, config))

  fun run(input: InputStream, output: OutputStream) {
    val handler = PacketHandler(
      queries,
      workers,
      send = { packet -> write(output, packet) },
      initialSequence = { Random.nextLong(0, 0x1_0000_0000L) },
      now = now,
    )
    val buffer = ByteArray(TunnelRoutes.MTU)
    var lastExpiry = now()
    try {
      while (!Thread.currentThread().isInterrupted) {
        val length = input.read(buffer)
        if (length < 0) break
        if (length > 0) handle(handler, buffer.copyOf(length), length)
        if (now() - lastExpiry > EXPIRY_MILLIS) {
          handler.expire()
          lastExpiry = now()
        }
      }
    } catch (closed: IOException) {
      // The tunnel was closed: the service is stopping.
    } finally {
      stop()
    }
  }

  // A packet that cannot be handled is dropped, as the network would drop it: an uncaught
  // exception would end the process, and the filter with it.
  private fun handle(handler: PacketHandler, packet: ByteArray, length: Int) {
    try {
      handler.handle(packet, length)
    } catch (dropped: Exception) {
    }
  }

  fun stop() {
    workers.shutdownNow()
    closeUpstream()
  }

  private fun write(output: OutputStream, packet: ByteArray) {
    try {
      synchronized(output) { output.write(packet) }
    } catch (closed: IOException) {
      // The tunnel closed while an answer was on its way.
    }
  }

  companion object {
    private const val WORKERS = 4
    private const val QUEUE = 64
    private const val EXPIRY_MILLIS = 10_000L
  }
}
