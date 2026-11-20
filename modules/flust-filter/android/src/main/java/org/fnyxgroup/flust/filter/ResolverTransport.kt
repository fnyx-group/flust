package org.fnyxgroup.flust.filter

import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import javax.net.ssl.SNIHostName
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLException
import javax.net.ssl.SSLPeerUnverifiedException
import javax.net.ssl.SSLSocket

// The only place the filter opens sockets. Production builds the endpoints of Resolvers.CHAIN; the
// tests build local ones. A test checks that no other file opens a socket.
class ResolverEndpoint(val host: String, val port: Int, val addresses: List<InetAddress>)

// Keeps a socket out of the tunnel: VpnService.protect in the service.
fun interface SocketProtector {
  fun protect(socket: Socket): Boolean
}

class ResolverTransport(
  private val endpoint: ResolverEndpoint,
  private val protector: SocketProtector,
  private val tls: SSLContext,
  private val connectTimeoutMillis: Int = 3_000,
  private val readTimeoutMillis: Int = 5_000,
) {
  @Volatile private var preferred = 0

  // A connection to the first address that answers, starting with the last one that did. Each
  // address gets the usual connect timeout, and all of them together no more than the budget.
  fun connect(budgetMillis: Int = connectTimeoutMillis * endpoint.addresses.size): DotConnection {
    val deadline = System.nanoTime() + budgetMillis * 1_000_000L
    var failure: IOException? = null
    for (step in endpoint.addresses.indices) {
      val left = ((deadline - System.nanoTime()) / 1_000_000L).toInt()
      if (left <= 0) break
      val index = (preferred + step) % endpoint.addresses.size
      try {
        return open(endpoint.addresses[index], minOf(connectTimeoutMillis, left)).also { preferred = index }
      } catch (error: IOException) {
        failure = error
      }
    }
    throw failure ?: SocketTimeoutException("No address of ${endpoint.host} answered in time")
  }

  fun open(address: InetAddress, timeoutMillis: Int = connectTimeoutMillis): DotConnection {
    require(address in endpoint.addresses) { "Not an address of the resolver: $address" }
    val socket = Socket()
    try {
      // Setting an option creates the socket's file descriptor, which protect needs.
      socket.soTimeout = readTimeoutMillis
      if (!protector.protect(socket)) throw IOException("The resolver socket cannot leave the tunnel")
      socket.connect(InetSocketAddress(address, endpoint.port), timeoutMillis)
      val secure = tls.socketFactory.createSocket(socket, endpoint.host, endpoint.port, true) as SSLSocket
      secure.sslParameters = secure.sslParameters.apply {
        endpointIdentificationAlgorithm = "HTTPS"
        serverNames = listOf(SNIHostName(endpoint.host))
        protocols = modernProtocols(protocols)
      }
      secure.startHandshake()
      if (!CertificateCheck.names(secure.session.peerCertificates, endpoint.host)) {
        throw SSLPeerUnverifiedException("The certificate does not name ${endpoint.host}")
      }
      return DotConnection(secure.inputStream, secure.outputStream, secure)
    } catch (error: Exception) {
      socket.close()
      throw error
    }
  }

  companion object {
    private val MODERN_PROTOCOLS = setOf("TLSv1.2", "TLSv1.3")

    // TLS 1.2 and later only. Older Android versions still enable 1.0 and 1.1 by default.
    internal fun modernProtocols(enabled: Array<String>): Array<String> {
      val kept = enabled.filter { it in MODERN_PROTOCOLS }
      if (kept.isEmpty()) throw SSLException("Neither TLS 1.2 nor TLS 1.3 is enabled")
      return kept.toTypedArray()
    }
  }
}
