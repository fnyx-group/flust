package org.fnyxgroup.flust.filter

import java.io.ByteArrayOutputStream
import java.io.PrintStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class CrashHandlerTest {
  private class Recorded : Thread.UncaughtExceptionHandler {
    val calls = mutableListOf<Pair<Thread, Throwable>>()

    override fun uncaughtException(thread: Thread, error: Throwable) {
      calls += thread to error
    }
  }

  private val thread = Thread("flust-test")
  private val error = IllegalStateException("crash")

  @Test
  fun runsItsWorkThenHandsTheCrashToThePreviousHandler() {
    val order = mutableListOf<String>()
    val previous = Thread.UncaughtExceptionHandler { _, _ -> order += "previous" }

    CrashHandler(previous) { order += "restart" }.uncaughtException(thread, error)

    assertEquals(listOf("restart", "previous"), order)
  }

  @Test
  fun passesTheSameThreadAndErrorOn() {
    val previous = Recorded()

    CrashHandler(previous) {}.uncaughtException(thread, error)

    assertEquals(1, previous.calls.size)
    assertSame(thread, previous.calls[0].first)
    assertSame(error, previous.calls[0].second)
  }

  // Nothing may keep the previous handler from ending the process.
  @Test
  fun stillHandsOverWhenItsOwnWorkThrows() {
    val previous = Recorded()

    CrashHandler(previous) { throw OutOfMemoryError() }.uncaughtException(thread, error)

    assertSame(error, previous.calls.single().second)
  }

  @Test
  fun printsTheCrashWhenThereIsNoPreviousHandler() {
    val printed = ByteArrayOutputStream()
    val standardError = System.err
    System.setErr(PrintStream(printed, true))
    try {
      CrashHandler(null) {}.uncaughtException(thread, error)
    } finally {
      System.setErr(standardError)
    }

    val text = printed.toString()
    assertTrue(text.startsWith("Exception in thread \"flust-test\" java.lang.IllegalStateException: crash"))
  }
}
