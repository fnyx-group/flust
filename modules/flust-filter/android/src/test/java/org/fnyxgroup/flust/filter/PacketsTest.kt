package org.fnyxgroup.flust.filter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PacketsTest {
  private val payload = TestData.query("example.com")

  @Test
  fun buildsAndReadsUdpOverIpv4() {
    val bytes = Packets.buildUdp(4, TestData.DNS_V4, TestData.CLIENT_V4, 53, 40000, payload)
    val packet = Packets.parse(bytes, bytes.size)!!
    val datagram = Packets.udp(packet)!!

    assertEquals(4, packet.version)
    assertArrayEquals(TestData.DNS_V4, packet.source)
    assertArrayEquals(TestData.CLIENT_V4, packet.destination)
    assertEquals(53, datagram.sourcePort)
    assertEquals(40000, datagram.destinationPort)
    assertArrayEquals(payload, datagram.payload)
    assertEquals(0, Packets.checksum(bytes, 0, 20, 0))
    assertEquals(0, transportChecksum(bytes, 20, TestData.DNS_V4, TestData.CLIENT_V4, Packets.PROTOCOL_UDP))
  }

  @Test
  fun buildsAndReadsUdpOverIpv6() {
    val bytes = Packets.buildUdp(6, TestData.DNS_V6, TestData.CLIENT_V6, 53, 40000, payload)
    val packet = Packets.parse(bytes, bytes.size)!!

    assertEquals(6, packet.version)
    assertArrayEquals(payload, Packets.udp(packet)!!.payload)
    assertEquals(0, transportChecksum(bytes, 40, TestData.DNS_V6, TestData.CLIENT_V6, Packets.PROTOCOL_UDP))
  }

  @Test
  fun buildsAndReadsTcp() {
    val bytes = Packets.buildTcp(
      4, TestData.DNS_V4, TestData.CLIENT_V4, 53, 40000, 0xfffffff0L, 7, Packets.TCP_ACK or Packets.TCP_PSH, payload,
    )
    val segment = Packets.tcp(Packets.parse(bytes, bytes.size)!!)!!

    assertEquals(0xfffffff0L, segment.sequence)
    assertEquals(7L, segment.acknowledgment)
    assertEquals(Packets.TCP_ACK or Packets.TCP_PSH, segment.flags)
    assertArrayEquals(payload, segment.payload)
    assertNull(segment.maxSegmentSize)
    assertEquals(0, transportChecksum(bytes, 20, TestData.DNS_V4, TestData.CLIENT_V4, Packets.PROTOCOL_TCP))
  }

  @Test
  fun readsTheMaximumSegmentSizeOfASyn() {
    val bytes = Packets.buildTcp(4, TestData.CLIENT_V4, TestData.DNS_V4, 40000, 53, 1, 0, Packets.TCP_SYN)
    val withOptions = bytes.copyOf(20 + 20) + byteArrayOf(1, 2, 4, 0x05, 0xb4.toByte(), 0, 0, 0)
    withOptions[3] = withOptions.size.toByte()
    withOptions[20 + 12] = (7 shl 4).toByte()

    assertEquals(1460, Packets.tcp(Packets.parse(withOptions, withOptions.size)!!)!!.maxSegmentSize)
  }

  @Test
  fun dropsFragmentsAndWhatItCannotRead() {
    val bytes = Packets.buildUdp(4, TestData.CLIENT_V4, TestData.DNS_V4, 40000, 53, payload)
    val fragment = bytes.copyOf().also { it[6] = 0x20 }
    assertNull(Packets.parse(fragment, fragment.size))
    assertNull(Packets.parse(bytes, 10))
    assertNull(Packets.parse(byteArrayOf(0x50), 1))
    assertNull(Packets.tcp(Packets.parse(bytes, bytes.size)!!))
  }

  private fun transportChecksum(packet: ByteArray, start: Int, source: ByteArray, destination: ByteArray, protocol: Int): Int {
    val segment = packet.copyOfRange(start, packet.size)
    var sum = 0L
    for (address in listOf(source, destination)) for (index in address.indices step 2) sum += TestData.u16(address, index)
    sum += protocol + segment.size
    return Packets.checksum(segment, 0, segment.size, sum)
  }
}
