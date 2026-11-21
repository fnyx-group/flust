package org.fnyxgroup.flust.filter

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

// A local VPN that carries DNS only (docs/product/content-filter.md). It reads its settings from
// FilterConfigStore and the compiled lists from the app's assets, never from the database.
class FilterVpnService : VpnService() {
  private class Tunnel(
    val descriptor: ParcelFileDescriptor,
    val engine: FilterEngine,
    val thread: Thread,
    val config: FilterConfig,
    val networks: ConnectivityManager.NetworkCallback?,
  )

  // What a start reads off the main thread, before any tunnel exists.
  private class Prepared(val lists: Blocklist, val listsMillis: Double, val listsCached: Boolean, val trustMillis: Double)

  private var tunnel: Tunnel? = null
  private var generation = 0
  private var trigger = TRIGGER_STICKY
  private val main = Handler(Looper.getMainLooper())
  private val starts = TunnelStarts()
  private val preparation: ExecutorService = Executors.newSingleThreadExecutor { task -> Thread(task, "flust-filter-start") }
  private val lists = FilterLists { Blocklist.read(assets.open(LISTS_ASSET).use { it.readBytes() }) }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      FilterTestLog.event("service stop requested")
      FilterRestartJob.cancel(this)
      starts.cancel()
      stopTunnel(StopReason.STOPPED)
      stopSelf()
      return START_NOT_STICKY
    }
    trigger = when {
      intent == null -> TRIGGER_STICKY
      intent.action == SERVICE_INTERFACE -> TRIGGER_ALWAYS_ON
      else -> intent.getStringExtra(EXTRA_TRIGGER) ?: TRIGGER_UNKNOWN
    }
    FilterTestLog.event("service started, trigger=$trigger")
    // Every start but a stop may come from startForegroundService, which must be answered.
    promote()
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
      FilterRestartJob.cancel(this)
      starts.cancel()
      stopTunnel(StopReason.STOPPED)
      stopSelf()
      return START_NOT_STICKY
    }
    if (!starts.covers(config, tunnel?.config)) prepare(config)
    return START_STICKY
  }

  // Called when flust is swiped away from recents, on the builds that call it before they kill.
  override fun onTaskRemoved(rootIntent: Intent?) {
    FilterTestLog.event("onTaskRemoved, running=${FilterStatus.running}")
    if (FilterConfigStore(this).load().enabled) FilterRestartJob.scheduleSoon(this, "task-removed")
    super.onTaskRemoved(rootIntent)
  }

  override fun onRevoke() {
    FilterTestLog.event("consent revoked")
    starts.cancel()
    stopTunnel(StopReason.REVOKED)
    super.onRevoke()
  }

  override fun onDestroy() {
    FilterTestLog.event("service destroyed")
    starts.cancel()
    preparation.shutdownNow()
    if (tunnel != null) FilterLog.stopped(this, null)
    stopTunnel(null)
    lists.release()
    super.onDestroy()
  }

  // Reads the lists and the system certificates off the main thread, where they took long enough
  // on slow phones to freeze flust. A running tunnel keeps filtering with its settings meanwhile,
  // and the new one is set up only once its lists are in memory, so a tunnel is never up without
  // them. A start that a stop, a revoked consent or newer settings made stale
  // is dropped (TunnelStarts).
  private fun prepare(config: FilterConfig) {
    val ticket = starts.begin(config)
    val requested = SystemClock.elapsedRealtimeNanos()
    preparation.execute {
      val step = try {
        val listsCached = lists.cached
        val listsStarted = SystemClock.elapsedRealtimeNanos()
        val read = lists.get()
        val trustStarted = SystemClock.elapsedRealtimeNanos()
        val failure: Throwable? = try {
          SystemTrust.context()
          null
        } catch (untrusted: Exception) {
          untrusted
        }
        val trusted = SystemClock.elapsedRealtimeNanos()
        val prepared = Prepared(read, millis(listsStarted, trustStarted), listsCached, millis(trustStarted, trusted))
        Runnable {
          if (!starts.finish(ticket)) return@Runnable
          if (failure != null) fail(StopReason.FAILED, failure) else startTunnel(config, prepared, requested)
        }
      } catch (unreadable: Exception) {
        Runnable { if (starts.finish(ticket)) fail(StopReason.LISTS, unreadable) }
      }
      main.post(step)
    }
  }

  // Sets up a new tunnel, then closes the one it replaces, so lookups never leave the filter in
  // between. Android's resolver keeps the answers it cached before (TunnelRoutes.DNS), so SafeSearch
  // answers last a minute at most (Dns.rewritten).
  private fun startTunnel(config: FilterConfig, prepared: Prepared, requested: Long): Boolean {
    val establishing = SystemClock.elapsedRealtimeNanos()
    var descriptor: ParcelFileDescriptor? = null
    var started: FilterEngine? = null
    var networks: ConnectivityManager.NetworkCallback? = null
    try {
      generation = (generation + 1) % TunnelRoutes.DNS.size
      val established = builder(TunnelRoutes.DNS[generation]).establish() ?: return fail(StopReason.NO_CONSENT)
      descriptor = established
      val trust = SystemTrust.context()
      val clients = Resolvers.CHAIN.map { endpoint ->
        val transport = ResolverTransport(endpoint, { socket -> protect(socket) }, trust)
        DotClient(transport::connect, System::currentTimeMillis, transport::close)
      }
      val chain = ResolverChain(clients, BackgroundThreads(clients.size), System::currentTimeMillis)
      val engine = FilterEngine(prepared.lists, config, chain, chain::stop)
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
      networks = watchNetworks(chain)
      tunnel = Tunnel(established, engine, reader, config, networks)
      FilterStatus.activeResolver = { chain.active()?.let(Resolvers.NAMES::get) }
      reader.start()
      previous?.let(::close)
    } catch (error: Exception) {
      // An established tunnel that no thread reads would swallow every lookup.
      started?.stop()
      networks?.let(::unwatch)
      try {
        descriptor?.close()
      } catch (ignored: Exception) {
      }
      return fail(StopReason.FAILED, error)
    }
    FilterStatus.running = true
    FilterStatus.recordStop(this, null)
    FilterTestLog.event("tunnel running, trigger=$trigger")
    FilterRestartJob.schedulePeriodic(this)
    val running = SystemClock.elapsedRealtimeNanos()
    FilterStatus.lastStart = TunnelStartTiming(
      listsMillis = prepared.listsMillis,
      listsCached = prepared.listsCached,
      trustMillis = prepared.trustMillis,
      establishMillis = millis(establishing, running),
      totalMillis = millis(requested, running),
    )
    return true
  }

  private fun promote() {
    try {
      ServiceCompat.startForeground(this, FilterNotification.ID, FilterNotification.build(this), foregroundType())
      FilterTestLog.event("foreground ok")
    } catch (refused: Exception) {
      FilterTestLog.event("foreground refused ${refused.javaClass.name}")
    }
  }

  // A VPN app with the user's consent may use the system-exempted type from Android 14.
  private fun foregroundType(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED else 0

  private fun millis(from: Long, to: Long): Double = (to - from) / 1_000_000.0

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
    FilterStatus.activeResolver = { null }
    close(running)
    FilterStatus.running = false
    if (reason != null) {
      FilterLog.stopped(this, reason)
      FilterStatus.recordStop(this, reason)
    }
  }

  // A resolver that fails on one network may answer on the next, and the other way round. The
  // chain is probed once at the start: the callback first reports the networks already there.
  private fun watchNetworks(chain: ResolverChain): ConnectivityManager.NetworkCallback? {
    val connectivity = getSystemService(ConnectivityManager::class.java)
    if (connectivity == null) {
      chain.start()
      return null
    }
    val request = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
      .build()
    val initial = currentNetworks(connectivity)
    val present = initial.orEmpty().toMutableSet()
    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) = changed { present += network.networkHandle }

      override fun onLost(network: Network) = changed { present -= network.networkHandle }

      private fun changed(update: () -> Unit) {
        val networks = synchronized(present) {
          update()
          present.toSet()
        }
        chain.networksChanged(networks)
      }
    }
    chain.start(initial)
    // Without ACCESS_NETWORK_STATE the chain is probed at the start and after failures only.
    return try {
      connectivity.registerNetworkCallback(request, callback)
      callback
    } catch (refused: SecurityException) {
      null
    }
  }

  // The networks the request above matches, read synchronously as in NetworkState.
  private fun currentNetworks(connectivity: ConnectivityManager): Set<Long>? =
    try {
      @Suppress("DEPRECATION")
      connectivity.allNetworks
        .filter { network ->
          val capabilities = connectivity.getNetworkCapabilities(network)
          capabilities != null &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
        }
        .map { it.networkHandle }
        .toSet()
    } catch (refused: SecurityException) {
      null
    }

  // A callback already unregistered, by the tunnel's own close, throws.
  private fun unwatch(callback: ConnectivityManager.NetworkCallback) {
    try {
      getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(callback)
    } catch (unregistered: IllegalArgumentException) {
    }
  }

  private fun close(old: Tunnel) {
    old.networks?.let(::unwatch)
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
    private const val EXTRA_TRIGGER = "org.fnyxgroup.flust.filter.TRIGGER"
    private const val TRIGGER_STICKY = "sticky-restart"
    private const val TRIGGER_ALWAYS_ON = "always-on"
    private const val TRIGGER_UNKNOWN = "unknown"

    // A foreground start, so that Android 8 and later accept it from the background: the
    // consent to the VPN exempts it from the background start limits of Android 12 and later.
    fun start(context: Context, trigger: String) {
      val intent = Intent(context, FilterVpnService::class.java).setAction(ACTION_START).putExtra(EXTRA_TRIGGER, trigger)
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.startService(Intent(context, FilterVpnService::class.java).setAction(ACTION_STOP))
    }
  }
}
