package org.fnyxgroup.flust.filter

import android.content.Context

// The compiled lists in the app's assets, read once per process and shared by every tunnel: a
// Blocklist is read-only, and reading 2.7 MB again at each change of the settings would slow the
// switch to the new tunnel. Released when the service stops.
object FilterLists {
  const val ASSET = "filter-lists.bin"

  @Volatile private var loaded: Blocklist? = null

  val cached: Boolean
    get() = loaded != null

  fun get(context: Context): Blocklist =
    loaded ?: synchronized(this) { loaded ?: read(context).also { loaded = it } }

  fun read(context: Context): Blocklist =
    Blocklist.read(context.assets.open(ASSET).use { it.readBytes() })

  fun release() {
    loaded = null
  }
}
