package org.fnyxgroup.flust.filter

import java.io.Closeable
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

// How long each step of an exchange may take. `connectMillis` covers every address of the
// resolver together. A query must not wait long on a resolver that may not answer: it gets short
// budgets and tries the next resolver. A probe runs in the background and can wait.
class Timeouts(val connectMillis: Int, val handshakeMillis: Int, val readMillis: Int) {
  companion object {
    val QUERY = Timeouts(connectMillis = 1_000, handshakeMillis = 2_000, readMillis = 3_000)
    val PROBE = Timeouts(connectMillis = 12_000, handshakeMillis = 5_000, readMillis = 5_000)
  }
}

class ResolverTransport(
  private val endpoint: ResolverEndpoint,
  private val protector: SocketProtector,
  private val tls: SSLContext,
  private val connectTimeoutMillis: Int = 3_000,
  private val newSocket: () -> Socket = ::Socket,
) {
  @Volatile private var preferred = 0

  // Every socket opened and not closed yet, connecting, in the handshake or in use, so that
  // close() ends them all at once rather than when their timeouts run out.
  private val sockets = mutableSetOf<Socket>()
  private var closed = false

  // A connection to the first address that answers, starting with the last one that did. Each
  // address gets the usual connect timeout, and all of them together no more than the budget.
  fun connect(timeouts: Timeouts = Timeouts.PROBE): DotConnection {
    val deadline = System.nanoTime() + timeouts.connectMillis * 1_000_000L
    var failure: IOException? = null
    for (step in endpoint.addresses.indices) {
      val left = ((deadline - System.nanoTime()) / 1_000_000L).toInt()
      if (left <= 0) break
      val index = (preferred + step) % endpoint.addresses.size
      try {
        return open(endpoint.addresses[index], timeouts, minOf(connectTimeoutMillis, left)).also { preferred = index }
      } catch (error: IOException) {
        failure = error
      }
    }
    throw failure ?: SocketTimeoutException("No address of ${endpoint.host} answered in time")
  }

  fun open(
    address: InetAddress,
    timeouts: Timeouts = Timeouts.PROBE,
    connectMillis: Int = minOf(connectTimeoutMillis, timeouts.connectMillis),
  ): DotConnection {
    require(address in endpoint.addresses) { "Not an address of the resolver: $address" }
    val socket = newSocket()
    if (!track(socket)) {
      socket.close()
      throw IOException("The filter has stopped")
    }
    try {
      // Setting an option creates the socket's file descriptor, which protect needs.
      socket.soTimeout = timeouts.handshakeMillis
      if (!protector.protect(socket)) throw IOException("The resolver socket cannot leave the tunnel")
      socket.connect(InetSocketAddress(address, endpoint.port), connectMillis)
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
      secure.soTimeout = timeouts.readMillis
      return DotConnection(
        secure.inputStream,
        secure.outputStream,
        Closeable {
          try {
            secure.close()
          } finally {
            untrack(socket)
          }
        },
        readTimeout = { millis -> secure.soTimeout = millis },
      )
    } catch (error: Exception) {
      socket.close()
      untrack(socket)
      throw error
    }
  }

  // Closes every socket of the resolver, and refuses new ones: the filter has stopped.
  fun close() {
    val open = synchronized(sockets) {
      closed = true
      sockets.toList().also { sockets.clear() }
    }
    for (socket in open) {
      try {
        socket.close()
      } catch (ignored: IOException) {
      }
    }
  }

  private fun track(socket: Socket): Boolean = synchronized(sockets) { !closed && sockets.add(socket) }

  private fun untrack(socket: Socket) {
    synchronized(sockets) { sockets.remove(socket) }
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
