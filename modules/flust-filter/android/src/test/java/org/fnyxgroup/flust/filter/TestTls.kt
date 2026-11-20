package org.fnyxgroup.flust.filter

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.net.InetAddress
import java.net.Socket
import java.nio.file.Files
import java.security.KeyStore
import java.security.cert.CertificateFactory
import java.util.concurrent.atomic.AtomicInteger
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLServerSocket
import javax.net.ssl.TrustManagerFactory
import kotlin.concurrent.thread

// Certificates made with the JDK's keytool for each run, so no key is committed: a test CA, server
// certificates it signs, and a self-signed one. A local DNS over TLS server answers every query.
object TestTls {
  private const val PASSWORD = "test-only"
  private val directory: File by lazy { Files.createTempDirectory("flust-tls").toFile().apply { deleteOnExit() } }
  private val keytool = File(System.getProperty("java.home"), "bin/keytool").path

  val loopback: InetAddress = InetAddress.getLoopbackAddress()

  private fun keytool(vararg arguments: String) {
    val process = ProcessBuilder(keytool, *arguments).directory(directory).redirectErrorStream(true).start()
    val output = process.inputStream.bufferedReader().readText()
    check(process.waitFor() == 0) { "keytool ${arguments.first()} failed: $output" }
  }

  private fun keyPair(store: String, alias: String, name: String, vararg extensions: String) = keytool(
    "-genkeypair", "-alias", alias, "-keyalg", "EC", "-groupname", "secp256r1", "-dname", "CN=$name",
    "-validity", "2", "-keystore", store, "-storetype", "PKCS12", "-storepass", PASSWORD, *extensions,
  )

  private val authority: File by lazy {
    keyPair("ca.p12", "ca", "flust test CA", "-ext", "bc:c")
    keytool("-exportcert", "-alias", "ca", "-keystore", "ca.p12", "-storepass", PASSWORD, "-rfc", "-file", "ca.pem")
    File(directory, "ca.pem")
  }

  // Trusts the test CA only, as the service trusts the system's certificates only.
  val clientContext: SSLContext by lazy {
    val store = KeyStore.getInstance(KeyStore.getDefaultType()).apply { load(null) }
    authority.inputStream().use { store.setCertificateEntry("ca", CertificateFactory.getInstance("X.509").generateCertificate(it)) }
    val trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(store) }
    SSLContext.getInstance("TLS").apply { init(null, trust.trustManagers, null) }
  }

  private val servers = mutableMapOf<String, File>()

  // A key store for a server whose certificate names `name`, signed by the test CA.
  @Synchronized
  fun signedFor(name: String): File = servers.getOrPut(name) {
    authority
    val store = "$name.p12"
    keyPair(store, "server", name)
    keytool("-certreq", "-alias", "server", "-keystore", store, "-storepass", PASSWORD, "-file", "$name.csr")
    keytool(
      "-gencert", "-alias", "ca", "-keystore", "ca.p12", "-storepass", PASSWORD, "-infile", "$name.csr",
      "-outfile", "$name.pem", "-rfc", "-validity", "2", "-ext", "san=dns:$name", "-ext", "eku=serverAuth",
    )
    keytool("-importcert", "-alias", "ca", "-keystore", store, "-storepass", PASSWORD, "-file", "ca.pem", "-noprompt")
    keytool("-importcert", "-alias", "server", "-keystore", store, "-storepass", PASSWORD, "-file", "$name.pem")
    File(directory, store)
  }

  val selfSigned: File by lazy {
    keyPair("self.p12", "server", Resolvers.QUAD9.host, "-ext", "san=dns:${Resolvers.QUAD9.host}")
    File(directory, "self.p12")
  }

  fun certificates(store: File) = KeyStore.getInstance("PKCS12").apply {
    store.inputStream().use { load(it, PASSWORD.toCharArray()) }
  }.getCertificateChain("server")

  // `answers` false completes the handshake, then reads queries and never answers them, as a
  // resolver that stopped answering would.
  class Server(store: File, private val answers: Boolean = true) : AutoCloseable {
    val accepted = AtomicInteger()
    private val socket: SSLServerSocket
    val port: Int

    init {
      val keys = KeyStore.getInstance("PKCS12").apply { store.inputStream().use { load(it, PASSWORD.toCharArray()) } }
      val managers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
        init(keys, PASSWORD.toCharArray())
      }
      val context = SSLContext.getInstance("TLS").apply { init(managers.keyManagers, null, null) }
      socket = context.serverSocketFactory.createServerSocket(0, 8, loopback) as SSLServerSocket
      port = socket.localPort
      thread(isDaemon = true) {
        while (!socket.isClosed) {
          val client = try { socket.accept() } catch (closed: Exception) { break }
          accepted.incrementAndGet()
          thread(isDaemon = true) { answer(client) }
        }
      }
    }

    private fun answer(client: Socket) = client.use {
      try {
        val input = DataInputStream(it.getInputStream())
        val output = DataOutputStream(it.getOutputStream())
        while (true) {
          val query = ByteArray(input.readUnsignedShort()).also(input::readFully)
          if (!answers) continue
          val answer = TestData.response(query, listOf(Triple(Dns.TYPE_A, 60L, byteArrayOf(9, 9, 9, 9))))
          output.writeShort(answer.size)
          output.write(answer)
          output.flush()
        }
      } catch (done: Exception) {
        // The client closed the connection, or the handshake failed.
      }
    }

    override fun close() = socket.close()
  }
}
