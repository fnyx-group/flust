package org.fnyxgroup.flust.filter

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// The filter's settings, which reveal what someone blocks and allows. Encrypted with AES-GCM under
// a key of their own in the Android Keystore, never the database's: the VPN service runs without
// the app and must not touch the database or its key (docs/decisions/0033). Kept in the no-backup
// directory. A file that cannot be read gives the defaults, with the filter off, and is never
// overwritten with them (FilterSettingsFile).
object FilterConfigStore {
  private const val FILE_NAME = "filter-config"

  @Volatile private var shared: FilterSettingsFile? = null

  // Every writer runs in this process and goes through this one instance and its lock.
  fun of(context: Context): FilterSettingsFile =
    shared ?: synchronized(this) {
      shared ?: FilterSettingsFile(File(context.applicationContext.noBackupFilesDir, FILE_NAME), KeystoreSeal)
        .also { shared = it }
    }

  private object KeystoreSeal : SettingsSeal {
    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "flust-filter-config"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128

    override fun seal(plain: ByteArray): ByteArray {
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.ENCRYPT_MODE, key())
      return cipher.iv + cipher.doFinal(plain)
    }

    override fun open(sealed: ByteArray): ByteArray {
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, sealed, 0, IV_BYTES))
      return cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES)
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
  }
}
