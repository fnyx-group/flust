package org.fnyxgroup.flust.filter

import java.io.ByteArrayOutputStream

// A query with one question, as stub resolvers send them. `questionEnd` is where the question
// ends in `bytes`: the question is copied from there into every answer flust builds, so the
// name keeps the case the client sent.
class DnsQuery(
  val bytes: ByteArray,
  val id: Int,
  val flags: Int,
  val name: String,
  val type: Int,
  val questionEnd: Int,
  val udpPayloadSize: Int,
)

class DnsRecord(val type: Int, val ttl: Long, val data: ByteArray)

object Dns {
  const val TYPE_A = 1
  const val TYPE_CNAME = 5
  const val TYPE_AAAA = 28
  const val TYPE_OPT = 41
  const val CLASS_IN = 1

  const val NOERROR = 0
  const val FORMERR = 1
  const val SERVFAIL = 2
  const val NXDOMAIN = 3
  const val NOTIMP = 4

  const val HEADER_BYTES = 12
  const val MIN_UDP_PAYLOAD = 512
  private const val MAX_UDP_PAYLOAD = 4096
  private const val FLAG_QR = 0x8000
  private const val FLAG_TC = 0x0200
  private const val FLAG_RD = 0x0100
  private const val FLAG_RA = 0x0080
  private const val OPCODE_MASK = 0x7800
  private const val MAX_POINTERS = 16
  private const val MAX_NAME_BYTES = 255

  // Null for anything other than a standard query with one question and an uncompressed name.
  fun parseQuery(bytes: ByteArray): DnsQuery? {
    if (bytes.size < HEADER_BYTES) return null
    val flags = u16(bytes, 2)
    if (flags and FLAG_QR != 0 || flags and OPCODE_MASK != 0 || u16(bytes, 4) != 1) return null
    val (name, nameEnd) = readName(bytes, HEADER_BYTES, allowPointers = false) ?: return null
    if (nameEnd + 4 > bytes.size) return null
    val type = u16(bytes, nameEnd)
    val questionEnd = nameEnd + 4
    return DnsQuery(bytes, u16(bytes, 0), flags, name, type, questionEnd, udpPayloadSize(bytes, questionEnd))
  }

  fun isQueryHeader(bytes: ByteArray): Boolean = bytes.size >= HEADER_BYTES && u16(bytes, 2) and FLAG_QR == 0

  // An answer without records, for a query flust read.
  fun answer(query: DnsQuery, rcode: Int): ByteArray =
    header(query.id, query.flags, rcode, answers = 0) + query.bytes.copyOfRange(HEADER_BYTES, query.questionEnd)

  // An error for a query flust could not read: its header only, without the question.
  fun error(bytes: ByteArray, rcode: Int): ByteArray =
    header(u16(bytes, 0), u16(bytes, 2), rcode, answers = 0, questions = 0)

  // A query for the SafeSearch target, sent to the resolver.
  fun query(id: Int, name: String, type: Int): ByteArray {
    val out = ByteArrayOutputStream()
    out.write(header(id, FLAG_RD, NOERROR, answers = 0, response = false))
    writeName(out, name)
    writeU16(out, type)
    writeU16(out, CLASS_IN)
    return out.toByteArray()
  }

  // The answer to a rewritten name: a CNAME to the target, then the target's records of the type
  // that was asked, all given to the target. The TTL is the shortest of the target's records.
  fun rewritten(query: DnsQuery, target: String, records: List<DnsRecord>): ByteArray {
    val ttl = records.minOfOrNull { it.ttl } ?: CNAME_TTL
    val out = ByteArrayOutputStream()
    out.write(header(query.id, query.flags, NOERROR, answers = 1 + records.size))
    out.write(query.bytes, HEADER_BYTES, query.questionEnd - HEADER_BYTES)
    writeU16(out, 0xc000 or HEADER_BYTES)
    writeU16(out, TYPE_CNAME)
    writeU16(out, CLASS_IN)
    writeU32(out, ttl)
    val targetName = ByteArrayOutputStream().also { writeName(it, target) }.toByteArray()
    writeU16(out, targetName.size)
    out.write(targetName)
    val targetOffset = query.questionEnd + 12
    for (record in records) {
      writeU16(out, 0xc000 or targetOffset)
      writeU16(out, record.type)
      writeU16(out, CLASS_IN)
      writeU32(out, ttl)
      writeU16(out, record.data.size)
      out.write(record.data)
    }
    return out.toByteArray()
  }

  // The records of `type` in a response's answer section, whatever name they belong to. Null
  // when the response is not a successful answer to `query`.
  fun records(response: ByteArray, query: ByteArray, type: Int): List<DnsRecord>? {
    if (!matches(query, response) || u16(response, 2) and 0x000f != NOERROR) return null
    var offset = skipQuestions(response) ?: return null
    val found = mutableListOf<DnsRecord>()
    repeat(u16(response, 6)) {
      val nameEnd = readName(response, offset, allowPointers = true)?.second ?: return null
      if (nameEnd + 10 > response.size) return null
      val recordType = u16(response, nameEnd)
      val ttl = u32(response, nameEnd + 4)
      val length = u16(response, nameEnd + 8)
      val dataStart = nameEnd + 10
      if (dataStart + length > response.size) return null
      if (recordType == type) found += DnsRecord(type, ttl, response.copyOfRange(dataStart, dataStart + length))
      offset = dataStart + length
    }
    return found
  }

  // Whether a response answers this query: same ID, and the same question, case aside.
  fun matches(query: ByteArray, response: ByteArray): Boolean {
    if (response.size < HEADER_BYTES || u16(response, 2) and FLAG_QR == 0) return false
    if (u16(query, 0) != u16(response, 0) || u16(response, 4) != 1) return false
    val asked = readName(query, HEADER_BYTES, allowPointers = false) ?: return false
    val answered = readName(response, HEADER_BYTES, allowPointers = false) ?: return false
    if (asked.second + 4 > query.size || answered.second + 4 > response.size) return false
    return asked.first.equals(answered.first, ignoreCase = true) &&
      u16(query, asked.second) == u16(response, answered.second) &&
      u16(query, asked.second + 2) == u16(response, answered.second + 2)
  }

  // A UDP answer larger than the client accepts is cut to its header and question, with TC set,
  // and the client asks again over TCP.
  fun fitForUdp(response: ByteArray, query: DnsQuery): ByteArray {
    if (response.size <= query.udpPayloadSize) return response
    val questionEnd = skipQuestions(response) ?: return answer(query, SERVFAIL)
    val truncated = response.copyOf(questionEnd)
    val flags = u16(truncated, 2) or FLAG_TC
    truncated[2] = (flags shr 8).toByte()
    truncated[3] = flags.toByte()
    for (index in 6 until 12) truncated[index] = 0
    return truncated
  }

  private const val CNAME_TTL = 300L

  private fun header(
    id: Int,
    queryFlags: Int,
    rcode: Int,
    answers: Int,
    questions: Int = 1,
    response: Boolean = true,
  ): ByteArray {
    val flags = if (response) FLAG_QR or (queryFlags and (OPCODE_MASK or FLAG_RD)) or FLAG_RA or rcode else queryFlags
    val out = ByteArrayOutputStream()
    writeU16(out, id)
    writeU16(out, flags)
    writeU16(out, questions)
    writeU16(out, answers)
    writeU16(out, 0)
    writeU16(out, 0)
    return out.toByteArray()
  }

  private fun udpPayloadSize(bytes: ByteArray, questionEnd: Int): Int {
    var offset = questionEnd
    val records = u16(bytes, 6) + u16(bytes, 8) + u16(bytes, 10)
    repeat(records) {
      val nameEnd = readName(bytes, offset, allowPointers = true)?.second ?: return MIN_UDP_PAYLOAD
      if (nameEnd + 10 > bytes.size) return MIN_UDP_PAYLOAD
      if (u16(bytes, nameEnd) == TYPE_OPT) {
        return u16(bytes, nameEnd + 2).coerceIn(MIN_UDP_PAYLOAD, MAX_UDP_PAYLOAD)
      }
      offset = nameEnd + 10 + u16(bytes, nameEnd + 8)
    }
    return MIN_UDP_PAYLOAD
  }

  private fun skipQuestions(message: ByteArray): Int? {
    var offset = HEADER_BYTES
    repeat(u16(message, 4)) {
      offset = (readName(message, offset, allowPointers = true)?.second ?: return null) + 4
    }
    return if (offset <= message.size) offset else null
  }

  // The name at `start`, lowercase, and where it ends in the message. A label holding a dot or a
  // byte outside printable ASCII makes the name unreadable: matching it against the lists could
  // be fooled. Reading stops as soon as the name passes 255 bytes, the limit of RFC 1035, so that
  // pointers cannot make it grow with the message.
  private fun readName(bytes: ByteArray, start: Int, allowPointers: Boolean): Pair<String, Int>? {
    val name = StringBuilder()
    var offset = start
    var end = -1
    var pointers = 0
    var wireLength = 1
    while (true) {
      if (offset >= bytes.size) return null
      val length = bytes[offset].toInt() and 0xff
      when {
        length == 0 -> {
          if (end < 0) end = offset + 1
          return name.toString() to end
        }
        length and 0xc0 == 0xc0 -> {
          if (!allowPointers || offset + 1 >= bytes.size || ++pointers > MAX_POINTERS) return null
          if (end < 0) end = offset + 2
          offset = ((length and 0x3f) shl 8) or (bytes[offset + 1].toInt() and 0xff)
        }
        length > 63 || offset + 1 + length > bytes.size -> return null
        else -> {
          wireLength += 1 + length
          if (wireLength > MAX_NAME_BYTES) return null
          if (name.isNotEmpty()) name.append('.')
          for (index in offset + 1..offset + length) {
            val char = (bytes[index].toInt() and 0xff).toChar()
            if (char == '.' || char < '!' || char > '~') return null
            name.append(char.lowercaseChar())
          }
          offset += 1 + length
        }
      }
    }
  }

  private fun writeName(out: ByteArrayOutputStream, name: String) {
    for (label in name.split('.').filter { it.isNotEmpty() }) {
      val bytes = label.toByteArray(Charsets.ISO_8859_1)
      out.write(bytes.size)
      out.write(bytes)
    }
    out.write(0)
  }

  internal fun u16(bytes: ByteArray, offset: Int): Int =
    if (offset + 1 >= bytes.size) 0 else ((bytes[offset].toInt() and 0xff) shl 8) or (bytes[offset + 1].toInt() and 0xff)

  private fun u32(bytes: ByteArray, offset: Int): Long =
    (u16(bytes, offset).toLong() shl 16) or u16(bytes, offset + 2).toLong()

  private fun writeU16(out: ByteArrayOutputStream, value: Int) {
    out.write(value shr 8 and 0xff)
    out.write(value and 0xff)
  }

  private fun writeU32(out: ByteArrayOutputStream, value: Long) {
    writeU16(out, (value shr 16).toInt() and 0xffff)
    writeU16(out, value.toInt() and 0xffff)
  }
}
