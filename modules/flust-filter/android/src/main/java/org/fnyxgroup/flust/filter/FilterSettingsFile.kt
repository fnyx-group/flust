package org.fnyxgroup.flust.filter

import java.io.File
import java.io.FileOutputStream

// How the settings file is sealed: the Android Keystore in the app (FilterConfigStore), a key of
// the JDK in the tests.
interface SettingsSeal {
  fun seal(plain: ByteArray): ByteArray

  fun open(sealed: ByteArray): ByteArray
}

// A read of the settings. A failed read gives the defaults, with the filter off, to act on for
// the moment: they are never saved, which would turn a passing Keystore error into a filter
// turned off without its delay.
data class ConfigRead(val config: FilterConfig, val failed: Boolean)

// The settings file. Every read, change and write holds one lock, so that a writer on one thread
// never undoes the change of a writer on another: the module's queue, the service and the jobs on
// the main thread. One instance per file and per process.
//
// The settings are opened once and kept in memory: the app reads them with the status every two
// seconds, on the JavaScript thread. A failed read is not kept, so a passing error does not last
// for the life of the process.
class FilterSettingsFile(private val file: File, private val seal: SettingsSeal) {
  private val lock = Any()
  private var cached: FilterConfig? = null

  fun read(): ConfigRead = synchronized(lock) { readLocked() }

  fun load(): FilterConfig = read().config

  // Null when the read failed: then nothing is written.
  fun update(change: (FilterConfig) -> FilterConfig): FilterConfig? = synchronized(lock) {
    val current = readLocked()
    if (current.failed) return null
    val next = change(current.config)
    if (next != current.config) write(next)
    next
  }

  private fun readLocked(): ConfigRead {
    cached?.let { return ConfigRead(it, failed = false) }
    if (!file.exists()) return ConfigRead(FilterConfig().also { cached = it }, failed = false)
    return try {
      val config = FilterConfig.decode(String(seal.open(file.readBytes()), Charsets.UTF_8))
      cached = config
      ConfigRead(config, failed = false)
    } catch (error: Exception) {
      ConfigRead(FilterConfig(), failed = true)
    }
  }

  private fun write(config: FilterConfig) {
    cached = null
    val sealed = seal.seal(config.encode().toByteArray(Charsets.UTF_8))
    val temporary = File.createTempFile(file.name, ".tmp", file.parentFile)
    try {
      FileOutputStream(temporary).use { stream ->
        stream.write(sealed)
        stream.fd.sync()
      }
      if (!temporary.renameTo(file)) throw IllegalStateException("Cannot save the filter settings")
      cached = config
    } finally {
      temporary.delete()
    }
  }
}

// What each writer changes. Null when the read failed and nothing was written.

// Turning the filter on, or changing its YouTube level, from the app. New notification words that
// cannot be used keep the ones stored before.
fun FilterSettingsFile.turnOn(youtube: YouTubeLevel, notification: NotificationText?): FilterConfig? =
  update { current ->
    FilterConfig(enabled = true, youtube = youtube, notification = notification ?: current.notification)
  }

// After the delay, from the app: turns the filter off, then asks the tunnel to stop. When that
// request throws, the filter is turned back on before the error goes up, so the setting never
// says off while the tunnel runs, and the app reports a stop that failed.
fun FilterSettingsFile.turnOffAndStop(stop: () -> Unit): FilterConfig? {
  var wasEnabled = false
  val off = update { current ->
    wasEnabled = current.enabled
    current.copy(enabled = false)
  } ?: return null
  try {
    stop()
  } catch (refused: Exception) {
    if (wasEnabled) {
      try {
        update { it.copy(enabled = true) }
      } catch (unsaved: Exception) {
        refused.addSuppressed(unsaved)
      }
    }
    throw refused
  }
  return off
}

// The always-on setting started the service: the person chose the filter there.
fun FilterSettingsFile.turnOnFromAlwaysOn(): FilterConfig? = update { it.copy(enabled = true) }

fun FilterSettingsFile.describe(text: NotificationText): FilterConfig? = update { it.copy(notification = text) }
