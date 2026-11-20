package org.fnyxgroup.flust.filter

import java.security.KeyStore
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory

// TLS that trusts the certificates that ship with Android only. A certificate authority the
// person or a device policy installed could otherwise read the lookups sent to the resolver.
// Built once per process: reading the system store is slow on some phones, and its certificates
// only change with a system update, which restarts the process.
object SystemTrust {
  @Volatile private var built: SSLContext? = null

  fun context(): SSLContext = built ?: synchronized(this) { built ?: build().also { built = it } }

  private fun build(): SSLContext {
    val android = KeyStore.getInstance("AndroidCAStore").apply { load(null) }
    val system = KeyStore.getInstance(KeyStore.getDefaultType()).apply { load(null) }
    for (alias in android.aliases()) {
      if (alias.startsWith("system:")) system.setCertificateEntry(alias, android.getCertificate(alias))
    }
    val trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(system) }
    return SSLContext.getInstance("TLS").apply { init(null, trust.trustManagers, null) }
  }
}
