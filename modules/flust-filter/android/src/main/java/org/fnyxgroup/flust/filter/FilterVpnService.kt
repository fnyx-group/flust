package org.fnyxgroup.flust.filter

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream

// A local VPN that carries DNS only (docs/product/content-filter.md). It reads its settings from
// FilterConfigStore and the compiled lists from the app's assets, never from the database.
class FilterVpnService : VpnService() {
  private class Tunnel(
    val descriptor: ParcelFileDescriptor,
    val engine: FilterEngine,
    val thread: Thread,
    val config: FilterConfig,
  )

  private var tunnel: Tunnel? = null
  private var generation = 0
  private val main = Handler(Looper.getMainLooper())

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopTunnel(StopReason.STOPPED)
      stopSelf()
      return START_NOT_STICKY
    }
    val store = FilterConfigStore(this)
    var config = store.load()
    // The always-on setting starts the service itself: the person chose the filter there.
    if (intent?.action == SERVICE_INTERFACE && !config.enabled) {
      config = config.copy(enabled = true)
      // The filter still starts if the choice cannot be saved: always-on asked for it.
      try {
        store.save(config)
      } catch (unsaved: Exception) {
      }
    }
    if (!config.enabled) {
      stopTunnel(StopReason.STOPPED)
      stopSelf()
      return START_NOT_STICKY
    }
    if (tunnel?.config == config) return START_STICKY
    return if (startTunnel(config)) START_STICKY else START_NOT_STICKY
  }

  override fun onRevoke() {
    stopTunnel(StopReason.REVOKED)
    super.onRevoke()
  }

  override fun onDestroy() {
    if (tunnel != null) FilterLog.stopped(this, null)
    stopTunnel(null)
    super.onDestroy()
  }

  // Sets up a new tunnel, then closes the one it replaces, so lookups never leave the filter in
  // between. A new tunnel also empties Android's DNS cache (TunnelRoutes.DNS): a name cached
  // before a stronger setting would otherwise still resolve until its answer expires.
  private fun startTunnel(config: FilterConfig): Boolean {
    val lists = try {
      Blocklist.read(assets.open(LISTS_ASSET).use { it.readBytes() })
    } catch (unreadable: Exception) {
      return fail(StopReason.LISTS, unreadable)
    }
    var descriptor: ParcelFileDescriptor? = null
    var started: FilterEngine? = null
    try {
      generation = (generation + 1) % TunnelRoutes.DNS.size
      val established = builder(TunnelRoutes.DNS[generation]).establish() ?: return fail(StopReason.NO_CONSENT)
      descriptor = established
      val transport = ResolverTransport(Quad9.ENDPOINT, { socket -> protect(socket) }, SystemTrust.context())
      val upstream = DotClient(transport::connect, System::currentTimeMillis)
      val engine = FilterEngine(lists, config, upstream, upstream::close)
      started = engine
      val reader = Thread({
        engine.run(FileInputStream(established.fileDescriptor), FileOutputStream(established.fileDescriptor))
        // The loop ends by itself when the tunnel fails, or when a newer tunnel replaced it. Only
        // the first stops the service, so the app shows the filter as inactive.
        main.post {
          if (tunnel?.engine === engine) {
            stopTunnel(StopReason.FAILED)
            stopSelf()
          }
        }
      }, "flust-filter")
      val previous = tunnel
      tunnel = Tunnel(established, engine, reader, config)
      reader.start()
      previous?.let(::close)
    } catch (error: Exception) {
      // An established tunnel that no thread reads would swallow every lookup.
      started?.stop()
      try {
        descriptor?.close()
      } catch (ignored: Exception) {
      }
      return fail(StopReason.FAILED, error)
    }
    FilterStatus.running = true
    FilterStatus.recordStop(this, null)
    return true
  }

  private fun fail(reason: StopReason, error: Throwable? = null): Boolean {
    FilterLog.stopped(this, reason, error)
    stopTunnel(null)
    FilterStatus.recordStop(this, reason)
    stopSelf()
    return false
  }

  private fun builder(dns: DnsAddresses): Builder = Builder().apply {
    setSession(TunnelRoutes.SESSION)
    setMtu(TunnelRoutes.MTU)
    setBlocking(true)
    addAddress(TunnelRoutes.INTERFACE_V4, 32)
    addAddress(TunnelRoutes.INTERFACE_V6, 128)
    addDnsServer(dns.v4)
    addDnsServer(dns.v6)
    addRoute(dns.v4, 32)
    addRoute(dns.v6, 128)
    TunnelRoutes.RESOLVERS.forEach { addRoute(it, TunnelRoutes.prefixLength(it)) }
    // A VPN is metered by default from Android 10, which would make apps hold back on Wi-Fi.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) setMetered(false)
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      setConfigureIntent(
        PendingIntent.getActivity(this@FilterVpnService, 0, launch, PendingIntent.FLAG_IMMUTABLE),
      )
    }
  }

  private fun stopTunnel(reason: StopReason?) {
    val running = tunnel ?: return
    tunnel = null
    close(running)
    FilterStatus.running = false
    if (reason != null) {
      FilterLog.stopped(this, reason)
      FilterStatus.recordStop(this, reason)
    }
  }

  private fun close(old: Tunnel) {
    old.engine.stop()
    try {
      old.descriptor.close()
    } catch (ignored: Exception) {
    }
    old.thread.interrupt()
  }

  companion object {
    const val ACTION_START = "org.fnyxgroup.flust.filter.START"
    const val ACTION_STOP = "org.fnyxgroup.flust.filter.STOP"
    const val LISTS_ASSET = "filter-lists.bin"

    fun start(context: Context) {
      context.startService(Intent(context, FilterVpnService::class.java).setAction(ACTION_START))
    }

    fun stop(context: Context) {
      context.startService(Intent(context, FilterVpnService::class.java).setAction(ACTION_STOP))
    }
  }
}
