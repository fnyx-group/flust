package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InputStream
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

// The engine as the service runs it, with the tunnel replaced by a queue of packets.
class FilterEngineTest {
  private class Tunnel : InputStream() {
    val incoming = LinkedBlockingQueue<ByteArray>()

    // One packet per read, like a tun device. An empty packet closes it.
    override fun read(buffer: ByteArray): Int {
      val packet = incoming.take()
      if (packet.isEmpty()) return -1
      packet.copyInto(buffer)
      return packet.size
    }

    override fun read(): Int = throw UnsupportedOperationException()
  }

  private class Output : java.io.OutputStream() {
    val packets = LinkedBlockingQueue<ByteArray>()
    override fun write(packet: ByteArray) {
      packets.put(packet.copyOf())
    }
    override fun write(byte: Int) = throw UnsupportedOperationException()
  }

  @Test
  fun answersQueriesFromTheTunnelUntilItCloses() {
    val tunnel = Tunnel()
    val output = Output()
    var upstreamClosed = false
    val engine = FilterEngine(
      TestData.lists,
      FilterConfig(enabled = true),
      Upstream { query -> TestData.response(query, emptyList()) },
      closeUpstream = { upstreamClosed = true },
    )
    val thread = Thread { engine.run(tunnel, output) }.apply { start() }

    tunnel.incoming.put(Packets.buildUdp(4, TestData.CLIENT_V4, TestData.DNS_V4, 40000, 53, TestData.query("adult.example")))
    tunnel.incoming.put(Packets.buildUdp(6, TestData.CLIENT_V6, TestData.DNS_V6, 40001, 53, TestData.query("example.org")))
    val answers = List(2) { output.packets.poll(5, TimeUnit.SECONDS)!! }
      .map { Packets.udp(Packets.parse(it, it.size)!!)!! }
      .sortedBy { it.destinationPort }

    assertEquals(Dns.NXDOMAIN, TestData.rcode(answers[0].payload))
    assertEquals(Dns.NOERROR, TestData.rcode(answers[1].payload))
    assertEquals(53, answers[0].sourcePort)

    tunnel.incoming.put(ByteArray(0))
    thread.join(5_000)
    assertTrue(!thread.isAlive)
    assertTrue(upstreamClosed)
  }

  @Test
  fun resetsAConnectionToAResolverOnAnotherPort() {
    val tunnel = Tunnel()
    val output = Output()
    val engine = FilterEngine(TestData.lists, FilterConfig(), Upstream { ByteArray(0) }, closeUpstream = {})
    val thread = Thread { engine.run(tunnel, output) }.apply { start() }
    val quad9 = byteArrayOf(9, 9, 9, 9)

    tunnel.incoming.put(Packets.buildTcp(4, TestData.CLIENT_V4, quad9, 40000, 853, 1, 0, Packets.TCP_SYN))
    val reset = output.packets.poll(5, TimeUnit.SECONDS)!!
    assertEquals(Packets.TCP_RST or Packets.TCP_ACK, Packets.tcp(Packets.parse(reset, reset.size)!!)!!.flags)

    tunnel.incoming.put(Packets.buildUdp(4, TestData.CLIENT_V4, quad9, 40000, 443, ByteArray(10)))
    tunnel.incoming.put(ByteArray(0))
    thread.join(5_000)
    assertTrue(output.packets.isEmpty())
  }
}
