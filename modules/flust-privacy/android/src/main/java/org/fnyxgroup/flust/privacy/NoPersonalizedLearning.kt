package org.fnyxgroup.flust.privacy

import android.content.Context
import android.view.View
import android.view.ViewTreeObserver
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText

// Asks the keyboard not to learn what is typed in flust's text fields, nor to suggest it
// elsewhere. Keyboards may ignore the flag. Set on focus rather than once per field: React
// Native rewrites imeOptions whenever returnKeyType changes, and a field added later is covered
// too. See docs/decisions/0036-keyboard-learning.md.
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
    field.imeOptions = field.imeOptions or FLAG
    // The keyboard may already have read the field's options as it took focus.
    val keyboard = field.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    keyboard?.restartInput(field)
  }

  private companion object {
    const val FLAG = EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
  }
}
