package org.fnyxgroup.flust.filter

import java.io.ByteArrayOutputStream

// Builds DNS messages and reads the compiled lists fixture (test/fixtures/filter-lists.bin,
// checked by scripts/lists/build.test.ts).
object TestData {
  val lists: Blocklist by lazy {
    Blocklist.read(TestData::class.java.getResourceAsStream("/filter-lists.bin")!!.use { it.readBytes() })
  }

  fun query(
    name: String,
    type: Int = Dns.TYPE_A,
    id: Int = 0x1234,
    flags: Int = 0x0100,
    udpPayloadSize: Int? = null,
  ): ByteArray {
    val out = ByteArrayOutputStream()
    u16(out, id)
    u16(out, flags)
    u16(out, 1)
    u16(out, 0)
    u16(out, 0)
    u16(out, if (udpPayloadSize != null) 1 else 0)
    name(out, name)
    u16(out, type)
    u16(out, Dns.CLASS_IN)
    if (udpPayloadSize != null) {
      out.write(0)
      u16(out, Dns.TYPE_OPT)
      u16(out, udpPayloadSize)
      out.write(ByteArray(6))
    }
    return out.toByteArray()
  }

  // A response to `query` with the given records, each as (type, ttl, data), owned by the
  // question's name through a pointer.
  fun response(query: ByteArray, records: List<Triple<Int, Long, ByteArray>>, rcode: Int = Dns.NOERROR): ByteArray {
    val questionEnd = questionEnd(query)
    val out = ByteArrayOutputStream()
    out.write(query, 0, 2)
    u16(out, 0x8180 or rcode)
    u16(out, 1)
    u16(out, records.size)
    u16(out, 0)
    u16(out, 0)
    out.write(query, 12, questionEnd - 12)
    for ((type, ttl, data) in records) {
      u16(out, 0xc00c)
      u16(out, type)
      u16(out, Dns.CLASS_IN)
      u16(out, (ttl shr 16).toInt())
      u16(out, ttl.toInt() and 0xffff)
      u16(out, data.size)
      out.write(data)
    }
    return out.toByteArray()
  }

  fun questionEnd(message: ByteArray): Int {
    var offset = 12
    while (message[offset].toInt() != 0) offset += 1 + message[offset]
    return offset + 5
  }

  fun u16(bytes: ByteArray, offset: Int) =
    ((bytes[offset].toInt() and 0xff) shl 8) or (bytes[offset + 1].toInt() and 0xff)

  fun rcode(message: ByteArray) = u16(message, 2) and 0x0f

  fun name(out: ByteArrayOutputStream, name: String) {
    for (label in name.split('.')) {
      val bytes = label.toByteArray(Charsets.ISO_8859_1)
      out.write(bytes.size)
      out.write(bytes)
    }
    out.write(0)
  }

  fun u16(out: ByteArrayOutputStream, value: Int) {
    out.write(value shr 8 and 0xff)
    out.write(value and 0xff)
  }

  val CLIENT_V4 = byteArrayOf(10, 111, 222.toByte(), 1)
  val DNS_V4 = byteArrayOf(10, 111, 222.toByte(), 2)
  val CLIENT_V6 = ByteArray(16).also { it[0] = 0xfd.toByte(); it[15] = 1 }
  val DNS_V6 = ByteArray(16).also { it[0] = 0xfd.toByte(); it[15] = 2 }
}
