package org.fnyxgroup.flust.filter

import java.io.File
import java.nio.file.Files
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FilterSettingsFileTest {
  // AES-GCM under a key of the JDK, as the Keystore seals it, and broken on demand, as a passing
  // Keystore error breaks it.
  private class TestSeal : SettingsSeal {
    private val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()

    @Volatile var broken = false

    override fun seal(plain: ByteArray): ByteArray {
      check(!broken) { "Keystore unavailable" }
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key)
      return cipher.iv + cipher.doFinal(plain)
    }

    override fun open(sealed: ByteArray): ByteArray {
      check(!broken) { "Keystore unavailable" }
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, sealed, 0, 12))
      return cipher.doFinal(sealed, 12, sealed.size - 12)
    }
  }

  private val folder = Files.createTempDirectory("filter-settings").toFile()
  private val file = File(folder, "filter-config")
  private val seal = TestSeal()

  @After
  fun removeFolder() {
    folder.deleteRecursively()
  }

  private val strict = FilterConfig(enabled = true, youtube = YouTubeLevel.STRICT, exceptions = setOf("example.org"))

  // A settings file written by an earlier process, so that the next read opens it.
  private fun stored(config: FilterConfig): FilterSettingsFile {
    FilterSettingsFile(file, seal).update { config }
    return FilterSettingsFile(file, seal)
  }

  @Test
  fun readsWhatItWrote() {
    val settings = stored(strict)

    assertEquals(ConfigRead(strict, failed = false), settings.read())
  }

  @Test
  fun readsTheDefaultsWithoutAFile() {
    assertEquals(ConfigRead(FilterConfig(), failed = false), FilterSettingsFile(file, seal).read())
  }

  @Test
  fun neverSavesAFailedRead() {
    val settings = stored(strict)
    val before = file.readBytes()
    seal.broken = true

    assertEquals(ConfigRead(FilterConfig(), failed = true), settings.read())
    assertNull(settings.update { it.copy(enabled = false) })
    assertNull(settings.turnOff())
    assertNull(settings.turnOn(YouTubeLevel.MODERATE, null))
    assertNull(settings.turnOnFromAlwaysOn())
    assertArrayEquals(before, file.readBytes())

    seal.broken = false
    assertEquals(strict, settings.load())
  }

  @Test
  fun leavesTheFileUntouchedWhenDescribedAfterAFailedRead() {
    val settings = stored(strict)
    val before = file.readBytes()
    val modified = file.lastModified()
    seal.broken = true

    assertNull(settings.describe(words("Background service", "Running in the background")))
    assertArrayEquals(before, file.readBytes())
    assertEquals(modified, file.lastModified())
    assertEquals(listOf("filter-config"), folder.list()?.toList())
  }

  @Test
  fun describesWithoutTouchingTheOtherSettings() {
    val english = words("Background service", "Running in the background")

    assertEquals(strict.copy(notification = english), stored(strict).describe(english))
    assertEquals(strict.copy(notification = english), FilterSettingsFile(file, seal).load())
  }

  @Test
  fun keepsTheStoredWordsWhenAStartGivesNone() {
    val english = words("Background service", "Running in the background")
    val settings = stored(FilterConfig(notification = english))

    assertEquals(FilterConfig(enabled = true, notification = english), settings.turnOn(YouTubeLevel.MODERATE, null))
  }

  @Test
  fun keepsTheChangeOfEachOfTwoConcurrentWriters() {
    val settings = stored(FilterConfig(enabled = true))
    val writes = 100
    val ready = CountDownLatch(2)
    val go = CountDownLatch(1)
    val pool = Executors.newFixedThreadPool(2)
    val writers = listOf("a", "b").map { writer ->
      pool.submit {
        ready.countDown()
        go.await()
        repeat(writes) { index -> settings.update { it.copy(exceptions = it.exceptions + "$writer$index.example.org") } }
      }
    }
    ready.await()
    go.countDown()
    writers.forEach { it.get(30, TimeUnit.SECONDS) }
    pool.shutdown()

    val expected = listOf("a", "b").flatMap { writer -> List(writes) { "$writer$it.example.org" } }.toSet()
    assertEquals(expected, settings.load().exceptions)
    assertEquals(expected, FilterSettingsFile(file, seal).load().exceptions)
  }

  @Test
  fun keepsNoFailedReadForTheNextRead() {
    val settings = stored(strict)
    seal.broken = true
    assertTrue(settings.read().failed)

    seal.broken = false
    assertFalse(settings.read().failed)
  }
}
