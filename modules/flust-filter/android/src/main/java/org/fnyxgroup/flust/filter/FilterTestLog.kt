package org.fnyxgroup.flust.filter

import android.util.Log

// The log of the restart field test, on in every build while the experiment lasts. Events and
// exception classes only, never a queried name or an address.
object FilterTestLog {
  private const val TAG = "FlustFilterTest"

  fun event(message: String) {
    Log.i(TAG, message)
  }
}
