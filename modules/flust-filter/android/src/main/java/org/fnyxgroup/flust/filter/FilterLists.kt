package org.fnyxgroup.flust.filter

// The compiled lists, read once per service and shared by every tunnel it sets up: a Blocklist is
// read-only, and reading 2.7 MB again at each change of the settings would slow the switch to the
// new tunnel. Released when the service stops: a start still being prepared then reads the lists
// for itself without keeping them, so they never outlive the service.
class FilterLists(private val read: () -> Blocklist) {
  private var loaded: Blocklist? = null
  private var released = false

  val cached: Boolean
    get() = synchronized(this) { loaded != null }

  // Reads outside the lock, so that release() on the main thread never waits for the read.
  fun get(): Blocklist {
    synchronized(this) { loaded?.let { return it } }
    val lists = read()
    synchronized(this) {
      if (!released && loaded == null) loaded = lists
      return loaded ?: lists
    }
  }

  fun release() {
    synchronized(this) {
      released = true
      loaded = null
    }
  }
}
