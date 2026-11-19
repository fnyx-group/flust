package org.fnyxgroup.flust.filter

import java.nio.ByteBuffer
import java.security.MessageDigest

// Bits of the category byte, written by scripts/lists/layout.ts.
object Categories {
  const val ADULT = 1
  const val AI_NUDIFY = 2
  const val BYPASS = 8
  const val GOOGLE = 16
}

// The compiled lists (scripts/lists/compile.ts): a header, then entries of an 8-byte SHA-256
// prefix and a category byte, sorted by hash as unsigned bytes. Read-only and shared between the
// threads that answer queries: absolute reads leave the buffer's position alone.
class Blocklist private constructor(private val data: ByteBuffer, val size: Int) {
  private val digests = object : ThreadLocal<MessageDigest>() {
    override fun initialValue(): MessageDigest = MessageDigest.getInstance("SHA-256")
  }

  // The categories of this exact name.
  fun exact(name: String): Int {
    val hash = hash(name)
    var low = 0
    var high = size - 1
    while (low <= high) {
      val middle = (low + high) ushr 1
      val offset = HEADER_BYTES + middle * ENTRY_BYTES
      val compared = data.getLong(offset).toULong().compareTo(hash)
      when {
        compared < 0 -> low = middle + 1
        compared > 0 -> high = middle - 1
        else -> return data.get(offset + HASH_BYTES).toInt() and 0xff
      }
    }
    return 0
  }

  // The categories of the name and of its parents down to two labels, as the build step reads
  // them (withParents in scripts/lists/domains.ts): `video.example.com`, then `example.com`.
  fun categories(name: String): Int {
    var bits = 0
    var start = 0
    while (true) {
      val dot = name.indexOf('.', start)
      if (dot < 0) return bits
      bits = bits or exact(name.substring(start))
      start = dot + 1
    }
  }

  private fun hash(name: String): ULong {
    val digest = digests.get()!!
    digest.reset()
    return ByteBuffer.wrap(digest.digest(name.toByteArray(Charsets.ISO_8859_1))).long.toULong()
  }

  companion object {
    private const val HEADER_BYTES = 12
    private const val HASH_BYTES = 8
    private const val ENTRY_BYTES = HASH_BYTES + 1
    private const val FORMAT_VERSION: Byte = 1

    fun read(bytes: ByteArray): Blocklist {
      require(bytes.size >= HEADER_BYTES) { "The filter lists are too short" }
      require(String(bytes, 0, 4, Charsets.US_ASCII) == "FLST") { "Not a filter lists file" }
      require(bytes[4] == FORMAT_VERSION) { "Unknown filter lists version ${bytes[4]}" }
      val buffer = ByteBuffer.wrap(bytes).asReadOnlyBuffer()
      val count = buffer.getInt(8)
      require(count >= 0 && HEADER_BYTES + count.toLong() * ENTRY_BYTES == bytes.size.toLong()) {
        "The filter lists do not hold the entries their header announces"
      }
      return Blocklist(buffer, count)
    }
  }
}
