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
  private var tunnel: ParcelFileDescriptor? = null
  private var engine: FilterEngine? = null
  private var thread: Thread? = null
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
      stopSelf()
      return START_NOT_STICKY
    }
    engine?.let {
      it.update(config)
      return START_STICKY
    }
    return if (startTunnel(config)) START_STICKY else START_NOT_STICKY
  }

  override fun onRevoke() {
    stopTunnel(StopReason.REVOKED)
    super.onRevoke()
  }

  override fun onDestroy() {
    stopTunnel(null)
    super.onDestroy()
  }

  private fun startTunnel(config: FilterConfig): Boolean {
    var descriptor: ParcelFileDescriptor? = null
    try {
      val lists = Blocklist.read(assets.open(LISTS_ASSET).use { it.readBytes() })
      val established = builder().establish()
      descriptor = established
      if (established == null) {
        FilterStatus.recordStop(this, StopReason.NO_CONSENT)
        stopSelf()
        return false
      }
      val transport = ResolverTransport(Quad9.ENDPOINT, { socket -> protect(socket) }, SystemTrust.context())
      val upstream = DotClient(transport::connect, System::currentTimeMillis)
      val running = FilterEngine(lists, config, upstream, upstream::close)
      val reader = Thread({
        running.run(FileInputStream(established.fileDescriptor), FileOutputStream(established.fileDescriptor))
        // The loop ends by itself only when the tunnel fails: the service then stops, so the app
        // shows the filter as inactive.
        main.post {
          if (engine === running) {
            stopTunnel(StopReason.FAILED)
            stopSelf()
          }
        }
      }, "flust-filter")
      tunnel = established
      engine = running
      thread = reader
      reader.start()
    } catch (error: Exception) {
      // An established tunnel that no thread reads would swallow every lookup.
      try {
        descriptor?.close()
      } catch (ignored: Exception) {
      }
      engine?.stop()
      engine = null
      tunnel = null
      thread = null
      FilterStatus.recordStop(this, StopReason.FAILED)
      stopSelf()
      return false
    }
    FilterStatus.running = true
    FilterStatus.recordStop(this, null)
    return true
  }

  private fun builder(): Builder = Builder().apply {
    setSession(TunnelRoutes.SESSION)
    setMtu(TunnelRoutes.MTU)
    setBlocking(true)
    addAddress(TunnelRoutes.INTERFACE_V4, 32)
    addAddress(TunnelRoutes.INTERFACE_V6, 128)
    addDnsServer(TunnelRoutes.DNS_V4)
    addDnsServer(TunnelRoutes.DNS_V6)
    addRoute(TunnelRoutes.DNS_V4, 32)
    addRoute(TunnelRoutes.DNS_V6, 128)
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
    val wasRunning = tunnel != null
    engine?.stop()
    try {
      tunnel?.close()
    } catch (ignored: Exception) {
    }
    thread?.interrupt()
    engine = null
    tunnel = null
    thread = null
    FilterStatus.running = false
    if (wasRunning && reason != null) FilterStatus.recordStop(this, reason)
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
