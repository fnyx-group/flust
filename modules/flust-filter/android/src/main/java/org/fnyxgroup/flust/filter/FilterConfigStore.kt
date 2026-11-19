package org.fnyxgroup.flust.filter

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.io.FileOutputStream
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// The filter's settings, which reveal what someone blocks and allows. Encrypted with AES-GCM under
// a key of their own in the Android Keystore, never the database's: the VPN service runs without
// the app and must not touch the database or its key (docs/decisions/0033). Kept in the no-backup
// directory. A file that cannot be read gives the defaults, with the filter off.
class FilterConfigStore(context: Context) {
  private val file = File(context.noBackupFilesDir, FILE_NAME)

  fun load(): FilterConfig = synchronized(LOCK) {
    if (!file.exists()) return FilterConfig()
    try {
      val stored = file.readBytes()
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, stored, 0, IV_BYTES))
      FilterConfig.decode(String(cipher.doFinal(stored, IV_BYTES, stored.size - IV_BYTES), Charsets.UTF_8))
    } catch (error: Exception) {
      FilterConfig()
    }
  }

  fun save(config: FilterConfig) = synchronized(LOCK) {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val sealed = cipher.iv + cipher.doFinal(config.encode().toByteArray(Charsets.UTF_8))
    val temporary = File.createTempFile(FILE_NAME, ".tmp", file.parentFile)
    try {
      FileOutputStream(temporary).use { stream ->
        stream.write(sealed)
        stream.fd.sync()
      }
      if (!temporary.renameTo(file)) throw IllegalStateException("Cannot save the filter settings")
    } finally {
      temporary.delete()
    }
  }

  private fun key(): SecretKey {
    val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (store.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  private companion object {
    const val FILE_NAME = "filter-config"
    const val KEYSTORE = "AndroidKeyStore"
    const val KEY_ALIAS = "flust-filter-config"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
    const val IV_BYTES = 12
    const val TAG_BITS = 128
    val LOCK = Any()
  }
}
