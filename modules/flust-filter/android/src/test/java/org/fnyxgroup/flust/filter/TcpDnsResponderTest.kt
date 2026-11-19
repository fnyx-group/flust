package org.fnyxgroup.flust.filter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TcpDnsResponderTest {
  private val sent = mutableListOf<TcpSegment>()
  private var clock = 0L
  private val pending = mutableListOf<(ByteArray?) -> Unit>()
  private val queries = mutableListOf<ByteArray>()
  private val responder = TcpDnsResponder(
    send = { bytes -> sent += Packets.tcp(Packets.parse(bytes, bytes.size)!!)!! },
    resolve = { query, reply ->
      queries += query
      pending += reply
    },
    initialSequence = { 1000 },
    now = { clock },
  )

  private fun client(sequence: Long, flags: Int, payload: ByteArray = ByteArray(0), port: Int = 53, ack: Long = 0) {
    val bytes = Packets.buildTcp(4, TestData.CLIENT_V4, TestData.DNS_V4, 40000, port, sequence, ack, flags, payload)
    val packet = Packets.parse(bytes, bytes.size)!!
    responder.handle(packet, Packets.tcp(packet)!!)
  }

  private fun framed(message: ByteArray) = byteArrayOf((message.size shr 8).toByte(), message.size.toByte()) + message

  private fun connect() {
    client(5000, Packets.TCP_SYN)
    sent.clear()
  }

  @Test
  fun acceptsAConnectionOnPort53() {
    client(5000, Packets.TCP_SYN)

    val synAck = sent.single()
    assertEquals(Packets.TCP_SYN or Packets.TCP_ACK, synAck.flags)
    assertEquals(1000L, synAck.sequence)
    assertEquals(5001L, synAck.acknowledgment)
    assertEquals(1, responder.openSessions)
  }

  @Test
  fun answersAQueryThatArrivesInSeveralSegments() {
    connect()
    val query = framed(TestData.query("example.com"))
    client(5001, Packets.TCP_ACK, query.copyOfRange(0, 5), ack = 1001)
    client(5006, Packets.TCP_ACK or Packets.TCP_PSH, query.copyOfRange(5, query.size), ack = 1001)

    assertArrayEquals(TestData.query("example.com"), queries.single())
    assertEquals(5001L + query.size, sent.last().acknowledgment)

    sent.clear()
    val answer = ByteArray(1500) { 7 }
    pending.single()(answer)

    val data = sent.flatMap { it.payload.toList() }.toByteArray()
    assertArrayEquals(framed(answer), data)
    assertEquals(1001L, sent.first().sequence)
    assertTrue(sent.all { it.payload.size <= 536 })
  }

  @Test
  fun closesAfterTheLastAnswerOnceTheClientIsDone() {
    connect()
    client(5001, Packets.TCP_ACK or Packets.TCP_FIN, framed(TestData.query("example.com")), ack = 1001)
    assertEquals(Packets.TCP_ACK, sent.last().flags)

    pending.single()(ByteArray(20))
    val fin = sent.last()
    assertEquals(Packets.TCP_FIN or Packets.TCP_ACK, fin.flags)

    client(fin.acknowledgment, Packets.TCP_ACK, ack = fin.sequence + 1)
    assertEquals(0, responder.openSessions)
  }

  @Test
  fun acknowledgesASegmentOutOfOrderWithoutReadingIt() {
    connect()
    client(5100, Packets.TCP_ACK, framed(TestData.query("example.com")), ack = 1001)

    assertTrue(queries.isEmpty())
    assertEquals(5001L, sent.single().acknowledgment)
  }

  @Test
  fun resetsOtherPortsAndUnknownConnectionsAtOnce() {
    client(9000, Packets.TCP_SYN, port = 853)
    assertEquals(Packets.TCP_RST or Packets.TCP_ACK, sent.single().flags)
    assertEquals(9001L, sent.single().acknowledgment)
    assertEquals(0, responder.openSessions)

    sent.clear()
    client(9000, Packets.TCP_ACK, ack = 4242)
    assertEquals(Packets.TCP_RST, sent.single().flags)
    assertEquals(4242L, sent.single().sequence)
  }

  @Test
  fun forgetsAConnectionOnResetAndWhenIdle() {
    connect()
    client(5001, Packets.TCP_RST)
    assertEquals(0, responder.openSessions)

    connect()
    clock += 31_000
    responder.expire()
    assertEquals(0, responder.openSessions)
  }

  @Test
  fun dropsTheAnswerOfAConnectionAlreadyGone() {
    connect()
    client(5001, Packets.TCP_ACK, framed(TestData.query("example.com")), ack = 1001)
    client(5001 + 15, Packets.TCP_RST)
    sent.clear()

    pending.single()(ByteArray(20))
    assertTrue(sent.isEmpty())
  }
}
