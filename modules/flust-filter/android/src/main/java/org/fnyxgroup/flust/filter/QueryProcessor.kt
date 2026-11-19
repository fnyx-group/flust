package org.fnyxgroup.flust.filter

import java.io.IOException
import java.util.concurrent.atomic.AtomicReference
import kotlin.random.Random

// Sends a query to the resolver and returns its answer. Blocks the calling thread.
fun interface Upstream {
  @Throws(IOException::class)
  fun exchange(query: ByteArray): ByteArray
}

// Answers one query: NXDOMAIN for a blocked name, the restricted version of a search engine, or
// the resolver's answer. Holds the name only while it answers: nothing is logged or cached.
class QueryProcessor(policy: FilterPolicy, private val upstream: Upstream) {
  private val policy = AtomicReference(policy)

  fun update(policy: FilterPolicy) = this.policy.set(policy)

  // Null when the bytes are not even a DNS header: there is no one to answer.
  fun answer(bytes: ByteArray, overUdp: Boolean): ByteArray? {
    val query = Dns.parseQuery(bytes)
    if (query == null) {
      return if (Dns.isQueryHeader(bytes)) Dns.error(bytes, if (opcode(bytes) != 0) Dns.NOTIMP else Dns.FORMERR) else null
    }
    val answer = when (val decision = policy.get().decide(query.name)) {
      Decision.Block -> Dns.answer(query, Dns.NXDOMAIN)
      Decision.Forward -> forward(query)
      is Decision.Rewrite -> rewrite(query, decision.target)
    }
    return if (overUdp) Dns.fitForUdp(answer, query) else answer
  }

  private fun forward(query: DnsQuery): ByteArray =
    try {
      upstream.exchange(query.bytes).takeIf { Dns.matches(query.bytes, it) } ?: Dns.answer(query, Dns.SERVFAIL)
    } catch (error: IOException) {
      Dns.answer(query, Dns.SERVFAIL)
    }

  private fun rewrite(query: DnsQuery, target: String): ByteArray {
    if (query.type != Dns.TYPE_A && query.type != Dns.TYPE_AAAA) return Dns.rewritten(query, target, emptyList())
    val targetQuery = Dns.query(Random.nextInt(0x10000), target, query.type)
    return try {
      val records = Dns.records(upstream.exchange(targetQuery), targetQuery, query.type)
      if (records == null) Dns.answer(query, Dns.SERVFAIL) else Dns.rewritten(query, target, records)
    } catch (error: IOException) {
      Dns.answer(query, Dns.SERVFAIL)
    }
  }

  private fun opcode(bytes: ByteArray) = (Dns.u16(bytes, 2) shr 11) and 0x0f
}
