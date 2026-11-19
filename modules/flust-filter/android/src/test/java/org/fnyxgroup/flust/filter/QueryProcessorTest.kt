package org.fnyxgroup.flust.filter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class QueryProcessorTest {
  private val sent = mutableListOf<ByteArray>()
  private var reply: (ByteArray) -> ByteArray = { query -> TestData.response(query, emptyList()) }
  private val processor = QueryProcessor(
    FilterPolicy(TestData.lists, FilterConfig(enabled = true)),
    Upstream { query -> sent += query; reply(query) },
  )

  @Test
  fun answersABlockedNameWithoutAskingTheResolver() {
    val answer = processor.answer(TestData.query("cdn.adult.example"), overUdp = true)!!

    assertEquals(Dns.NXDOMAIN, TestData.rcode(answer))
    assertTrue(sent.isEmpty())
  }

  @Test
  fun forwardsAnAllowedQueryAsItCame() {
    val query = TestData.query("example.org", udpPayloadSize = 1232)
    val response = TestData.response(query, listOf(Triple(Dns.TYPE_A, 60L, byteArrayOf(1, 2, 3, 4))))
    reply = { response }

    assertArrayEquals(response, processor.answer(query, overUdp = true))
    assertArrayEquals(query, sent.single())
  }

  @Test
  fun answersServfailWhenTheResolverFailsOrAnswersSomethingElse() {
    reply = { throw IOException("unreachable") }
    assertEquals(Dns.SERVFAIL, TestData.rcode(processor.answer(TestData.query("example.org"), overUdp = true)!!))

    reply = { TestData.response(TestData.query("other.example"), emptyList()) }
    assertEquals(Dns.SERVFAIL, TestData.rcode(processor.answer(TestData.query("example.org"), overUdp = true)!!))
  }

  @Test
  fun resolvesTheSafeSearchTargetItself() {
    val address = byteArrayOf(216.toByte(), 239.toByte(), 38, 120)
    reply = { query -> TestData.response(query, listOf(Triple(Dns.TYPE_A, 300L, address))) }
    val query = TestData.query("www.google.com")
    val answer = processor.answer(query, overUdp = true)!!

    assertEquals("forcesafesearch.google.com", Dns.parseQuery(sent.single())!!.name)
    assertTrue(Dns.matches(query, answer))
    assertArrayEquals(address, Dns.records(answer, query, Dns.TYPE_A)!!.single().data)
    assertEquals(1, Dns.records(answer, query, Dns.TYPE_CNAME)!!.size)
  }

  @Test
  fun answersOtherTypesOfASearchNameWithTheCnameAlone() {
    val query = TestData.query("www.bing.com", type = 65)
    val answer = processor.answer(query, overUdp = true)!!

    assertTrue(sent.isEmpty())
    assertEquals(1, TestData.u16(answer, 6))
  }

  @Test
  fun cutsALargeAnswerOverUdpOnly() {
    val query = TestData.query("example.org")
    reply = { TestData.response(it, List(40) { Triple(Dns.TYPE_A, 60L, byteArrayOf(1, 2, 3, 4)) }) }

    assertTrue(TestData.u16(processor.answer(query, overUdp = true)!!, 2) and 0x0200 != 0)
    assertEquals(40, TestData.u16(processor.answer(query, overUdp = false)!!, 6))
  }

  @Test
  fun answersWhatItCannotRead() {
    assertNull(processor.answer(ByteArray(3), overUdp = true))
    assertEquals(Dns.NOTIMP, TestData.rcode(processor.answer(TestData.query("example.org", flags = 0x2000), overUdp = true)!!))
    val compressed = TestData.query("example.org").copyOf(12) + byteArrayOf(0xc0.toByte(), 12, 0, 1, 0, 1)
    assertEquals(Dns.FORMERR, TestData.rcode(processor.answer(compressed, overUdp = true)!!))
  }
}
