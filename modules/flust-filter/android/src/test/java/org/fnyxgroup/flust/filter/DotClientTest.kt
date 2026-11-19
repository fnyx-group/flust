package org.fnyxgroup.flust.filter

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.IOException

class DotClientTest {
  private var clock = 0L
  private val opened = mutableListOf<Fake>()

  private inner class Fake(answers: Int) {
    val written = ByteArrayOutputStream()
    var closed = false
    val connection: DotConnection

    init {
      val framed = ByteArrayOutputStream()
      repeat(answers) {
        framed.write(0)
        framed.write(ANSWER.size)
        framed.write(ANSWER)
      }
      connection = DotConnection(ByteArrayInputStream(framed.toByteArray()), written, Closeable { closed = true })
    }
  }

  private fun client(answersPerConnection: Int = 2) = DotClient(
    connect = { Fake(answersPerConnection).also { opened += it }.connection },
    now = { clock },
  )

  @Test
  fun framesEachMessageWithItsLength() {
    client().exchange(byteArrayOf(1, 2, 3))

    assertArrayEquals(byteArrayOf(0, 3, 1, 2, 3), opened.single().written.toByteArray())
  }

  @Test
  fun keepsAConnectionForTheNextQuery() {
    val client = client()
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(1)))
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(2)))

    assertEquals(1, opened.size)
  }

  @Test
  fun opensANewConnectionWhenTheKeptOneFails() {
    val client = client(answersPerConnection = 1)
    client.exchange(byteArrayOf(1))
    assertArrayEquals(ANSWER, client.exchange(byteArrayOf(2)))

    assertEquals(2, opened.size)
    assertTrue(opened[0].closed)
  }

  @Test
  fun closesAConnectionLeftIdleTooLong() {
    val client = client()
    client.exchange(byteArrayOf(1))
    clock += 21_000
    client.exchange(byteArrayOf(2))

    assertEquals(2, opened.size)
    assertTrue(opened[0].closed)
  }

  @Test
  fun closesEverythingAndRefusesQueriesOnceClosed() {
    val client = client()
    client.exchange(byteArrayOf(1))
    client.close()

    assertTrue(opened.single().closed)
    assertThrows(IOException::class.java) { client.exchange(byteArrayOf(2)) }
    assertEquals(1, opened.size)
  }

  @Test
  fun passesOnTheFailureOfANewConnection() {
    val client = client(answersPerConnection = 0)

    assertThrows(IOException::class.java) { client.exchange(byteArrayOf(1)) }
    assertTrue(opened.single().closed)
  }

  private companion object {
    val ANSWER = byteArrayOf(0x12, 0x34, 0x81.toByte(), 0x80.toByte())
  }
}
