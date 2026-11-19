package org.fnyxgroup.flust.filter

// An IP packet read from the tunnel. Fragments and IPv6 extension headers are not read: DNS
// queries never need them, and anything flust cannot read is dropped.
class IpPacket(
  val version: Int,
  val source: ByteArray,
  val destination: ByteArray,
  val protocol: Int,
  val data: ByteArray,
  val payloadOffset: Int,
  val payloadLength: Int,
)

class UdpDatagram(val sourcePort: Int, val destinationPort: Int, val payload: ByteArray)

class TcpSegment(
  val sourcePort: Int,
  val destinationPort: Int,
  val sequence: Long,
  val acknowledgment: Long,
  val flags: Int,
  val maxSegmentSize: Int?,
  val payload: ByteArray,
) {
  fun has(flag: Int) = flags and flag != 0
}

object Packets {
  const val PROTOCOL_TCP = 6
  const val PROTOCOL_UDP = 17

  const val TCP_FIN = 0x01
  const val TCP_SYN = 0x02
  const val TCP_RST = 0x04
  const val TCP_PSH = 0x08
  const val TCP_ACK = 0x10

  private const val IPV4_HEADER = 20
  private const val IPV6_HEADER = 40
  private const val UDP_HEADER = 8
  private const val TCP_HEADER = 20
  private const val TTL = 64

  fun parse(buffer: ByteArray, length: Int): IpPacket? {
    if (length < 1) return null
    return when ((buffer[0].toInt() and 0xff) shr 4) {
      4 -> parseIpv4(buffer, length)
      6 -> parseIpv6(buffer, length)
      else -> null
    }
  }

  private fun parseIpv4(buffer: ByteArray, length: Int): IpPacket? {
    if (length < IPV4_HEADER) return null
    val headerLength = (buffer[0].toInt() and 0x0f) * 4
    val totalLength = u16(buffer, 2)
    val fragment = u16(buffer, 6)
    if (headerLength < IPV4_HEADER || totalLength < headerLength || totalLength > length) return null
    if (fragment and 0x3fff != 0) return null
    return IpPacket(
      4,
      buffer.copyOfRange(12, 16),
      buffer.copyOfRange(16, 20),
      buffer[9].toInt() and 0xff,
      buffer,
      headerLength,
      totalLength - headerLength,
    )
  }

  private fun parseIpv6(buffer: ByteArray, length: Int): IpPacket? {
    if (length < IPV6_HEADER) return null
    val payloadLength = u16(buffer, 4)
    if (IPV6_HEADER + payloadLength > length) return null
    return IpPacket(
      6,
      buffer.copyOfRange(8, 24),
      buffer.copyOfRange(24, 40),
      buffer[6].toInt() and 0xff,
      buffer,
      IPV6_HEADER,
      payloadLength,
    )
  }

  fun udp(packet: IpPacket): UdpDatagram? {
    if (packet.protocol != PROTOCOL_UDP || packet.payloadLength < UDP_HEADER) return null
    val start = packet.payloadOffset
    val length = u16(packet.data, start + 4)
    if (length < UDP_HEADER || length > packet.payloadLength) return null
    return UdpDatagram(
      u16(packet.data, start),
      u16(packet.data, start + 2),
      packet.data.copyOfRange(start + UDP_HEADER, start + length),
    )
  }

  fun tcp(packet: IpPacket): TcpSegment? {
    if (packet.protocol != PROTOCOL_TCP || packet.payloadLength < TCP_HEADER) return null
    val start = packet.payloadOffset
    val headerLength = ((packet.data[start + 12].toInt() and 0xff) shr 4) * 4
    if (headerLength < TCP_HEADER || headerLength > packet.payloadLength) return null
    return TcpSegment(
      u16(packet.data, start),
      u16(packet.data, start + 2),
      u32(packet.data, start + 4),
      u32(packet.data, start + 8),
      packet.data[start + 13].toInt() and 0x3f,
      maxSegmentSize(packet.data, start + TCP_HEADER, start + headerLength),
      packet.data.copyOfRange(start + headerLength, start + packet.payloadLength),
    )
  }

  private fun maxSegmentSize(data: ByteArray, start: Int, end: Int): Int? {
    var offset = start
    while (offset < end) {
      when (val kind = data[offset].toInt() and 0xff) {
        0 -> return null
        1 -> offset += 1
        else -> {
          if (offset + 1 >= end) return null
          val length = data[offset + 1].toInt() and 0xff
          if (length < 2 || offset + length > end) return null
          if (kind == 2 && length == 4) return u16(data, offset + 2)
          offset += length
        }
      }
    }
    return null
  }

  // A UDP datagram in an IP packet of the same version, from `source` to `destination`.
  fun buildUdp(
    version: Int,
    source: ByteArray,
    destination: ByteArray,
    sourcePort: Int,
    destinationPort: Int,
    payload: ByteArray,
  ): ByteArray {
    val segment = ByteArray(UDP_HEADER + payload.size)
    putU16(segment, 0, sourcePort)
    putU16(segment, 2, destinationPort)
    putU16(segment, 4, segment.size)
    payload.copyInto(segment, UDP_HEADER)
    var checksum = transportChecksum(source, destination, PROTOCOL_UDP, segment)
    // A computed zero is sent as all ones: zero means no checksum, which IPv6 forbids.
    if (checksum == 0) checksum = 0xffff
    putU16(segment, 6, checksum)
    return ip(version, source, destination, PROTOCOL_UDP, segment)
  }

  fun buildTcp(
    version: Int,
    source: ByteArray,
    destination: ByteArray,
    sourcePort: Int,
    destinationPort: Int,
    sequence: Long,
    acknowledgment: Long,
    flags: Int,
    payload: ByteArray = ByteArray(0),
  ): ByteArray {
    val segment = ByteArray(TCP_HEADER + payload.size)
    putU16(segment, 0, sourcePort)
    putU16(segment, 2, destinationPort)
    putU32(segment, 4, sequence)
    putU32(segment, 8, acknowledgment)
    segment[12] = ((TCP_HEADER / 4) shl 4).toByte()
    segment[13] = flags.toByte()
    putU16(segment, 14, 0xffff)
    payload.copyInto(segment, TCP_HEADER)
    putU16(segment, 16, transportChecksum(source, destination, PROTOCOL_TCP, segment))
    return ip(version, source, destination, PROTOCOL_TCP, segment)
  }

  private fun ip(version: Int, source: ByteArray, destination: ByteArray, protocol: Int, segment: ByteArray): ByteArray =
    if (version == 4) {
      val packet = ByteArray(IPV4_HEADER + segment.size)
      packet[0] = 0x45
      putU16(packet, 2, packet.size)
      packet[8] = TTL.toByte()
      packet[9] = protocol.toByte()
      source.copyInto(packet, 12)
      destination.copyInto(packet, 16)
      putU16(packet, 10, checksum(packet, 0, IPV4_HEADER, 0))
      segment.copyInto(packet, IPV4_HEADER)
      packet
    } else {
      val packet = ByteArray(IPV6_HEADER + segment.size)
      packet[0] = 0x60
      putU16(packet, 4, segment.size)
      packet[6] = protocol.toByte()
      packet[7] = TTL.toByte()
      source.copyInto(packet, 8)
      destination.copyInto(packet, 24)
      segment.copyInto(packet, IPV6_HEADER)
      packet
    }

  private fun transportChecksum(source: ByteArray, destination: ByteArray, protocol: Int, segment: ByteArray): Int {
    var sum = sum(source, 0, source.size, 0)
    sum = sum(destination, 0, destination.size, sum)
    sum += protocol + segment.size
    return checksum(segment, 0, segment.size, sum)
  }

  internal fun checksum(data: ByteArray, start: Int, length: Int, initial: Long): Int {
    var sum = sum(data, start, length, initial)
    while (sum shr 16 != 0L) sum = (sum and 0xffff) + (sum shr 16)
    return sum.inv().toInt() and 0xffff
  }

  private fun sum(data: ByteArray, start: Int, length: Int, initial: Long): Long {
    var sum = initial
    var index = start
    while (index + 1 < start + length) {
      sum += u16(data, index)
      index += 2
    }
    if (index < start + length) sum += (data[index].toInt() and 0xff) shl 8
    return sum
  }

  private fun u16(data: ByteArray, offset: Int) =
    ((data[offset].toInt() and 0xff) shl 8) or (data[offset + 1].toInt() and 0xff)

  private fun u32(data: ByteArray, offset: Int) =
    (u16(data, offset).toLong() shl 16) or u16(data, offset + 2).toLong()

  private fun putU16(data: ByteArray, offset: Int, value: Int) {
    data[offset] = (value shr 8).toByte()
    data[offset + 1] = value.toByte()
  }

  private fun putU32(data: ByteArray, offset: Int, value: Long) {
    putU16(data, offset, (value shr 16).toInt())
    putU16(data, offset + 2, value.toInt())
  }
}
