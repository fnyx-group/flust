package org.fnyxgroup.flust.filter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DnsMessageTest {
  @Test
  fun readsAQuery() {
    val query = Dns.parseQuery(TestData.query("WWW.Example.COM", Dns.TYPE_AAAA, id = 0xbeef))!!
    assertEquals("www.example.com", query.name)
    assertEquals(Dns.TYPE_AAAA, query.type)
    assertEquals(0xbeef, query.id)
    assertEquals(Dns.MIN_UDP_PAYLOAD, query.udpPayloadSize)
  }

  @Test
  fun readsTheUdpSizeOfEdns() {
    assertEquals(1232, Dns.parseQuery(TestData.query("example.com", udpPayloadSize = 1232))!!.udpPayloadSize)
    assertEquals(4096, Dns.parseQuery(TestData.query("example.com", udpPayloadSize = 65000))!!.udpPayloadSize)
    assertEquals(512, Dns.parseQuery(TestData.query("example.com", udpPayloadSize = 100))!!.udpPayloadSize)
  }

  @Test
  fun refusesWhatIsNotAPlainQuery() {
    assertNull(Dns.parseQuery(ByteArray(5)))
    assertNull(Dns.parseQuery(TestData.query("example.com", flags = 0x8180)))
    assertNull(Dns.parseQuery(TestData.query("example.com", flags = 0x2800)))
    val twoQuestions = TestData.query("example.com").also { it[5] = 2 }
    assertNull(Dns.parseQuery(twoQuestions))
    val compressed = TestData.query("example.com").copyOf(12) + byteArrayOf(0xc0.toByte(), 12, 0, 1, 0, 1)
    assertNull(Dns.parseQuery(compressed))
    assertNull(Dns.parseQuery(TestData.query("example.com").copyOf(20)))
  }

  @Test
  fun refusesANameThatCouldFoolTheMatch() {
    val dotInLabel = TestData.query("adult.example").also { it[15] = '.'.code.toByte() }
    assertNull(Dns.parseQuery(dotInLabel))
    val space = TestData.query("adult.example").also { it[14] = ' '.code.toByte() }
    assertNull(Dns.parseQuery(space))
  }

  @Test
  fun answersNxdomainWithTheQuestionAsAsked() {
    val bytes = TestData.query("Adult.Example", id = 0x4242)
    val answer = Dns.answer(Dns.parseQuery(bytes)!!, Dns.NXDOMAIN)
    assertEquals(0x4242, TestData.u16(answer, 0))
    assertEquals(0x8183, TestData.u16(answer, 2))
    assertEquals(1, TestData.u16(answer, 4))
    assertEquals(0, TestData.u16(answer, 6))
    assertArrayEquals(bytes.copyOfRange(12, bytes.size), answer.copyOfRange(12, answer.size))
    assertTrue(Dns.matches(bytes, answer))
  }

  @Test
  fun answersAnUnreadableQueryWithItsHeaderOnly() {
    val bytes = TestData.query("example.com", flags = 0x2900)
    val error = Dns.error(bytes, Dns.NOTIMP)
    assertEquals(12, error.size)
    assertEquals(0xa984, TestData.u16(error, 2))
    assertEquals(0, TestData.u16(error, 4))
  }

  @Test
  fun buildsTheRewrittenAnswer() {
    val bytes = TestData.query("www.google.fr")
    val address = byteArrayOf(216.toByte(), 239.toByte(), 38, 120)
    val records = listOf(DnsRecord(Dns.TYPE_A, 120, address), DnsRecord(Dns.TYPE_A, 60, address))
    val answer = Dns.rewritten(Dns.parseQuery(bytes)!!, SafeSearch.GOOGLE, records)

    assertEquals(3, TestData.u16(answer, 6))
    assertTrue(Dns.matches(bytes, answer))
    val read = Dns.records(answer, bytes, Dns.TYPE_A)!!
    assertEquals(2, read.size)
    assertEquals(60L, read[0].ttl)
    assertArrayEquals(address, read[0].data)
    val cname = Dns.records(answer, bytes, Dns.TYPE_CNAME)!!.single()
    val target = java.io.ByteArrayOutputStream().also { TestData.name(it, SafeSearch.GOOGLE) }.toByteArray()
    assertArrayEquals(target, cname.data)
  }

  // Android kept a moderate YouTube answer for half an hour after Strict YouTube was turned on,
  // the resolver's TTL: a rewritten answer must expire within a minute.
  @Test
  fun capsTheTtlOfARewrittenAnswerAtAMinute() {
    val bytes = TestData.query("www.youtube.com")
    val address = byteArrayOf(216.toByte(), 239.toByte(), 38, 120)
    val records = listOf(DnsRecord(Dns.TYPE_A, 1917, address), DnsRecord(Dns.TYPE_A, 3600, address))
    val answer = Dns.rewritten(Dns.parseQuery(bytes)!!, SafeSearch.YOUTUBE_STRICT, records)

    assertEquals(listOf(60L, 60L), Dns.records(answer, bytes, Dns.TYPE_A)!!.map { it.ttl })
    assertEquals(60L, Dns.records(answer, bytes, Dns.TYPE_CNAME)!!.single().ttl)
  }

  // A type other than A and AAAA, such as HTTPS, gets the CNAME alone.
  @Test
  fun givesARewrittenAnswerWithoutRecordsAMinute() {
    val https = 65
    val bytes = TestData.query("www.bing.com", type = https)
    val answer = Dns.rewritten(Dns.parseQuery(bytes)!!, SafeSearch.BING, emptyList())

    assertEquals(60L, Dns.records(answer, bytes, Dns.TYPE_CNAME)!!.single().ttl)
  }

  @Test
  fun readsTheRecordsOfAResponseOnlyWhenItAnswersTheQuery() {
    val query = TestData.query("forcesafesearch.google.com")
    val response = TestData.response(query, listOf(Triple(Dns.TYPE_A, 300L, byteArrayOf(1, 2, 3, 4))))
    assertEquals(1, Dns.records(response, query, Dns.TYPE_A)!!.size)
    assertNull(Dns.records(response, TestData.query("forcesafesearch.google.com", id = 1), Dns.TYPE_A))
    assertNull(Dns.records(TestData.response(query, emptyList(), Dns.NXDOMAIN), query, Dns.TYPE_A))
    assertFalse(Dns.matches(query, TestData.response(TestData.query("other.example"), emptyList())))
    assertFalse(Dns.matches(query, query))
  }

  @Test
  fun cutsAnAnswerTooLargeForTheClient() {
    val bytes = TestData.query("example.com")
    val query = Dns.parseQuery(bytes)!!
    val large = TestData.response(bytes, List(40) { Triple(Dns.TYPE_A, 300L, byteArrayOf(1, 2, 3, 4)) })
    val cut = Dns.fitForUdp(large, query)

    assertTrue(large.size > 512)
    assertEquals(TestData.questionEnd(bytes), cut.size)
    assertTrue(TestData.u16(cut, 2) and 0x0200 != 0)
    assertEquals(0, TestData.u16(cut, 6))
    assertNotNull(Dns.records(cut, bytes, Dns.TYPE_A))
    val small = TestData.response(bytes, emptyList())
    assertArrayEquals(small, Dns.fitForUdp(small, query))
  }

  @Test
  fun refusesANameLongerThan255Bytes() {
    val longest = List(4) { "a".repeat(63) }.joinToString(".").dropLast(2)
    assertEquals(253, longest.length)
    assertEquals(longest, Dns.parseQuery(TestData.query(longest))!!.name)
    assertNull(Dns.parseQuery(TestData.query(longest + "a")))
  }

  @Test
  fun stopsReadingANameThatPointersMakeLonger() {
    // The answer's name is a 63-byte label and a pointer back to it: following the pointers would
    // repeat the label 16 times.
    val query = TestData.query("example.org")
    val response = TestData.response(query, emptyList())
    val labelAt = response.size + 12
    val record = java.io.ByteArrayOutputStream()
    TestData.u16(record, 0xc000 or labelAt)
    TestData.u16(record, Dns.TYPE_A)
    TestData.u16(record, Dns.CLASS_IN)
    TestData.u16(record, 0)
    TestData.u16(record, 60)
    TestData.u16(record, 0)
    record.write(63)
    record.write(ByteArray(63) { 'a'.code.toByte() })
    TestData.u16(record, 0xc000 or labelAt)
    val looping = (response + record.toByteArray()).also { it[7] = 1 }

    assertNull(Dns.records(looping, query, Dns.TYPE_A))
  }
}
