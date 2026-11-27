package org.fnyxgroup.flust.filter

// Runs `onCrash` before the handler it replaces, which ends the process as before. Nothing thrown
// by `onCrash` may keep that handler from running.
//
// Without a previous handler, it does what Java does when there is none: print the stack trace.
// `thread.threadGroup.uncaughtException` would call the default handler again, which is this one.
class CrashHandler(
  private val previous: Thread.UncaughtExceptionHandler?,
  private val onCrash: () -> Unit,
) : Thread.UncaughtExceptionHandler {
  override fun uncaughtException(thread: Thread, error: Throwable) {
    try {
      onCrash()
    } catch (ignored: Throwable) {
    }
    if (previous != null) {
      previous.uncaughtException(thread, error)
    } else {
      System.err.print("Exception in thread \"${thread.name}\" ")
      error.printStackTrace(System.err)
    }
  }
}
