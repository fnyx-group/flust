package org.fnyxgroup.flust.privacy

import android.content.Context
import android.view.View
import android.view.ViewTreeObserver
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText

// Asks the keyboard not to learn what is typed in flust's text fields, nor to suggest it
// elsewhere. Keyboards may ignore the flag. Set on focus rather than once per field: React
// Native rewrites imeOptions when some props are set, and a field added later is covered too.
// See docs/decisions/0036-keyboard-learning.md.
internal class NoPersonalizedLearning(private val root: View) :
  ViewTreeObserver.OnGlobalFocusChangeListener {

  fun attach() {
    root.viewTreeObserver.addOnGlobalFocusChangeListener(this)
  }

  // The observer of a view can be replaced as it is attached: the current one holds the listener.
  fun detach() {
    val observer = root.viewTreeObserver
    if (observer.isAlive) observer.removeOnGlobalFocusChangeListener(this)
  }

  override fun onGlobalFocusChanged(oldFocus: View?, newFocus: View?) {
    val field = newFocus as? EditText ?: return
    if (field.imeOptions and FLAG != 0) return
    // React Native rewrites imeOptions when returnKeyType or disableFullscreenUI is set: a change
    // to either while the field has focus would drop the flag until it takes focus again. flust's
    // fields set both once, when mounted.
    field.imeOptions = field.imeOptions or FLAG
    // This listener runs before the field starts the keyboard's input, so the restart is likely
    // not needed. It is kept in case the input had already started, and runs at most once per
    // field since the flag is then set.
    val keyboard = field.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    keyboard?.restartInput(field)
  }

  private companion object {
    const val FLAG = EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
  }
}
