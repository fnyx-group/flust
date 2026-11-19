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
      busy = { Dns.parseQuery(datagram.payload)?.let { Dns.answer(it, Dns.SERVFAIL) } },
    )
  }

  private fun resolve(query: ByteArray, reply: (ByteArray?) -> Unit) =
    run(
      task = { queries.answer(query, overUdp = false) },
      reply = reply,
      busy = { Dns.parseQuery(query)?.let { Dns.answer(it, Dns.SERVFAIL) } },
    )

  // When every worker is busy and the queue is full, the client gets SERVFAIL at once and tries
  // again, rather than waiting for its own timeout.
  private fun run(task: () -> ByteArray?, reply: (ByteArray?) -> Unit, busy: () -> ByteArray?) {
    try {
      executor.execute { reply(task()) }
    } catch (error: RejectedExecutionException) {
      reply(busy())
    }
  }
}
