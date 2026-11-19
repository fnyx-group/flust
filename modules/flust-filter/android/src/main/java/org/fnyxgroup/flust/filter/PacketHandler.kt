package org.fnyxgroup.flust.filter

import java.util.concurrent.Executor
import java.util.concurrent.RejectedExecutionException

// Every packet in the tunnel goes to the fake DNS address or to a public resolver's address,
// since those are the only routes flust adds. DNS on port 53 is answered, over UDP and TCP. Other
// TCP connections, such as DNS over TLS or HTTPS to a resolver's address, are reset; other UDP,
// such as DNS over QUIC, is dropped.
class PacketHandler(
  private val queries: QueryProcessor,
  private val executor: Executor,
  private val send: (ByteArray) -> Unit,
  initialSequence: () -> Long,
  now: () -> Long,
) {
  private val tcp = TcpDnsResponder(send, ::resolve, initialSequence, now)

  fun handle(buffer: ByteArray, length: Int) {
    val packet = Packets.parse(buffer, length) ?: return
    when (packet.protocol) {
      Packets.PROTOCOL_UDP -> Packets.udp(packet)?.let { udp(packet, it) }
      Packets.PROTOCOL_TCP -> Packets.tcp(packet)?.let { tcp.handle(packet, it) }
    }
  }

  fun expire() = tcp.expire()

  private fun udp(packet: IpPacket, datagram: UdpDatagram) {
    if (datagram.destinationPort != TcpDnsResponder.DNS_PORT) return
    run(
      task = { queries.answer(datagram.payload, overUdp = true) },
      reply = { answer ->
        if (answer != null) send(
          Packets.buildUdp(
            packet.version,
            packet.destination,
            packet.source,
            datagram.destinationPort,
            datagram.sourcePort,
            answer,
          ),
        )
      },
      failed = { servfail(datagram.payload) },
    )
  }

  private fun resolve(query: ByteArray, reply: (ByteArray?) -> Unit) =
    run(
      task = { queries.answer(query, overUdp = false) },
      reply = reply,
      failed = { servfail(query) },
    )

  // When every worker is busy and the queue is full, the client gets SERVFAIL at once and tries
  // again, rather than waiting for its own timeout. A lookup that fails in any way gets SERVFAIL
  // too: an uncaught exception would end the process, and the filter with it.
  private fun run(task: () -> ByteArray?, reply: (ByteArray?) -> Unit, failed: () -> ByteArray?) {
    try {
      executor.execute {
        val answer = try {
          task()
        } catch (error: Exception) {
          failed()
        }
        try {
          reply(answer)
        } catch (lost: Exception) {
          // The answer is lost, as a dropped packet would be, and the client asks again.
        }
      }
    } catch (error: RejectedExecutionException) {
      reply(failed())
    }
  }

  private fun servfail(bytes: ByteArray): ByteArray? =
    try {
      Dns.parseQuery(bytes)?.let { Dns.answer(it, Dns.SERVFAIL) }
    } catch (error: Exception) {
      null
    }
}
