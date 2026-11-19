package org.fnyxgroup.flust.filter

import java.io.ByteArrayOutputStream

// The server side of DNS over TCP inside the tunnel, used when an answer is too large for UDP and
// by apps that query a resolver over TCP. Only what DNS needs: a handshake, queries framed by
// their length, answers, and a close. Packets inside the tunnel are not lost, so nothing is
// retransmitted; a segment out of order is answered with the expected acknowledgment and
// dropped. Any other TCP connection into the tunnel is reset at once, so that apps fall back
// without waiting for a timeout.
class TcpDnsResponder(
  private val send: (ByteArray) -> Unit,
  private val resolve: (query: ByteArray, reply: (ByteArray?) -> Unit) -> Unit,
  private val initialSequence: () -> Long,
  private val now: () -> Long,
) {
  private class Session(
    val version: Int,
    val local: ByteArray,
    val remote: ByteArray,
    val localPort: Int,
    val remotePort: Int,
    val maxSegmentSize: Int,
    var sendNext: Long,
    var receiveNext: Long,
    var lastActivity: Long,
  ) {
    val received = ByteArrayOutputStream()
    var pending = 0
    var remoteFinished = false
    var finSent = false
  }

  private val sessions = HashMap<String, Session>()

  val openSessions: Int
    get() = synchronized(this) { sessions.size }

  fun handle(packet: IpPacket, segment: TcpSegment) = synchronized(this) {
    val key = key(packet.source, segment.sourcePort, packet.destination, segment.destinationPort)
    val session = sessions[key]
    when {
      segment.has(Packets.TCP_RST) -> sessions.remove(key)
      segment.destinationPort != DNS_PORT -> reset(packet, segment)
      segment.has(Packets.TCP_SYN) && !segment.has(Packets.TCP_ACK) -> accept(key, session, packet, segment)
      session == null -> reset(packet, segment)
      else -> receive(key, session, segment)
    }
  }

  // Closes sessions left idle, such as a client that went away without a FIN.
  fun expire() = synchronized(this) {
    val limit = now() - IDLE_MILLIS
    sessions.entries.removeAll { it.value.lastActivity < limit }
  }

  private fun accept(key: String, existing: Session?, packet: IpPacket, segment: TcpSegment) {
    if (existing == null && sessions.size >= MAX_SESSIONS) return reset(packet, segment)
    val session = existing ?: Session(
      version = packet.version,
      local = packet.destination,
      remote = packet.source,
      localPort = segment.destinationPort,
      remotePort = segment.sourcePort,
      maxSegmentSize = (segment.maxSegmentSize ?: defaultSegmentSize(packet.version)).coerceIn(MIN_SEGMENT, MAX_SEGMENT),
      sendNext = initialSequence() and MASK,
      receiveNext = (segment.sequence + 1) and MASK,
      lastActivity = now(),
    ).also {
      sessions[key] = it
      it.sendNext = (it.sendNext + 1) and MASK
    }
    // A repeated SYN gets the same SYN-ACK again.
    emit(session, (session.sendNext - 1) and MASK, Packets.TCP_SYN or Packets.TCP_ACK)
  }

  private fun receive(key: String, session: Session, segment: TcpSegment) {
    session.lastActivity = now()
    if (session.finSent && segment.has(Packets.TCP_ACK) && segment.acknowledgment == session.sendNext) {
      sessions.remove(key)
      return
    }
    val inOrder = segment.sequence == session.receiveNext
    if (!inOrder || session.remoteFinished) {
      if (segment.payload.isNotEmpty() || segment.has(Packets.TCP_FIN)) acknowledge(session)
      return
    }
    if (segment.payload.isNotEmpty()) {
      session.received.write(segment.payload)
      session.receiveNext = (session.receiveNext + segment.payload.size) and MASK
      if (session.received.size() > MAX_BUFFERED) {
        sessions.remove(key)
        emit(session, session.sendNext, Packets.TCP_RST or Packets.TCP_ACK)
        return
      }
      takeQueries(key, session)
    }
    if (segment.has(Packets.TCP_FIN)) {
      session.receiveNext = (session.receiveNext + 1) and MASK
      session.remoteFinished = true
    }
    if (segment.payload.isNotEmpty() || segment.has(Packets.TCP_FIN)) acknowledge(session)
    closeWhenDone(session)
  }

  private fun takeQueries(key: String, session: Session) {
    var bytes = session.received.toByteArray()
    while (bytes.size >= 2) {
      val length = ((bytes[0].toInt() and 0xff) shl 8) or (bytes[1].toInt() and 0xff)
      if (bytes.size < 2 + length) break
      val query = bytes.copyOfRange(2, 2 + length)
      bytes = bytes.copyOfRange(2 + length, bytes.size)
      session.pending += 1
      resolve(query) { answer -> deliver(key, session, answer) }
    }
    session.received.reset()
    session.received.write(bytes)
  }

  // A null answer, for bytes that were not a query, only counts the query as done.
  private fun deliver(key: String, session: Session, answer: ByteArray?) = synchronized(this) {
    if (sessions[key] !== session) return@synchronized
    session.pending -= 1
    if (answer == null) return@synchronized closeWhenDone(session)
    val framed = ByteArray(2 + answer.size)
    framed[0] = (answer.size shr 8).toByte()
    framed[1] = answer.size.toByte()
    answer.copyInto(framed, 2)
    var offset = 0
    while (offset < framed.size) {
      val end = minOf(offset + session.maxSegmentSize, framed.size)
      emit(session, session.sendNext, Packets.TCP_ACK or Packets.TCP_PSH, framed.copyOfRange(offset, end))
      session.sendNext = (session.sendNext + (end - offset)) and MASK
      offset = end
    }
    closeWhenDone(session)
  }

  private fun closeWhenDone(session: Session) {
    if (!session.remoteFinished || session.pending > 0 || session.finSent) return
    emit(session, session.sendNext, Packets.TCP_FIN or Packets.TCP_ACK)
    session.sendNext = (session.sendNext + 1) and MASK
    session.finSent = true
  }

  private fun acknowledge(session: Session) = emit(session, session.sendNext, Packets.TCP_ACK)

  private fun emit(session: Session, sequence: Long, flags: Int, payload: ByteArray = ByteArray(0)) {
    send(
      Packets.buildTcp(
        session.version,
        session.local,
        session.remote,
        session.localPort,
        session.remotePort,
        sequence,
        session.receiveNext,
        flags,
        payload,
      ),
    )
  }

  // RFC 9293, 3.10.7.1: a reset that the sender will accept for this segment.
  private fun reset(packet: IpPacket, segment: TcpSegment) {
    if (segment.has(Packets.TCP_RST)) return
    val length = segment.payload.size + (if (segment.has(Packets.TCP_SYN)) 1 else 0) + (if (segment.has(Packets.TCP_FIN)) 1 else 0)
    val (sequence, flags) =
      if (segment.has(Packets.TCP_ACK)) segment.acknowledgment to Packets.TCP_RST
      else 0L to (Packets.TCP_RST or Packets.TCP_ACK)
    send(
      Packets.buildTcp(
        packet.version,
        packet.destination,
        packet.source,
        segment.destinationPort,
        segment.sourcePort,
        sequence,
        (segment.sequence + length) and MASK,
        flags,
      ),
    )
  }

  private fun key(source: ByteArray, sourcePort: Int, destination: ByteArray, destinationPort: Int) =
    "${source.toHex()}:$sourcePort>${destination.toHex()}:$destinationPort"

  private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }

  private fun defaultSegmentSize(version: Int) = if (version == 4) 536 else 1220

  companion object {
    const val DNS_PORT = 53
    private const val MASK = 0xffffffffL
    private const val MAX_SESSIONS = 64
    private const val MAX_BUFFERED = 2 * (2 + 65535)
    private const val MIN_SEGMENT = 536
    private const val MAX_SEGMENT = 1400
    private const val IDLE_MILLIS = 30_000L
  }
}
