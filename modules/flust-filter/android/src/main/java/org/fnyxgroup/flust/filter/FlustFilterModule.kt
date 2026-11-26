package org.fnyxgroup.flust.filter

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

// The two choices the app offers (docs/decisions/0038-content-filter.md). Adult sites, AI porn,
// strict mode and SafeSearch are always on while the filter runs: a switch for each would be a way
// to weaken the filter in a weak moment.
class FilterSettingsRecord : Record {
  @Field val youtubeStrict: Boolean = false
  @Field val notification: FilterNotificationRecord = FilterNotificationRecord()

  val youtube: YouTubeLevel
    get() = if (youtubeStrict) YouTubeLevel.STRICT else YouTubeLevel.MODERATE
}

// The words of the foreground service's notification, in the language chosen in the app.
class FilterNotificationRecord : Record {
  @Field val channelName: String = ""
  @Field val text: String = ""

  fun toText(): NotificationText? = NotificationText.of(channelName, text)
}

// The bridge to the filter. In the builds where the VPN service is not declared, every call
// reports the filter as unavailable and starts nothing.
class FlustFilterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.AppContextLost()

  private var consent: Promise? = null
  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("FlustFilter")

    // Called on the JavaScript thread, every two seconds while the filter screen is open: the
    // settings, the stop reason and the availability come from memory.
    Function("getStatus") {
      val config = FilterConfigStore.of(context).load()
      val running = FilterStatus.running
      val networks = NetworkState.networks(context)
      mapOf(
        "available" to available(),
        "consent" to (available() && VpnService.prepare(context) == null),
        "running" to running,
        "stopReason" to FilterStatus.stopReason(context),
        "enabled" to config.enabled,
        "youtubeStrict" to (config.youtube == YouTubeLevel.STRICT),
        "strictPrivateDns" to NetworkChecks.strictPrivateDns(networks),
        "otherVpn" to NetworkChecks.otherVpn(networks, running),
      )
    }

    // Shows Android's VPN consent dialog when it is needed. Resolves with whether consent holds.
    AsyncFunction("requestConsent") { promise: Promise ->
      if (!available()) return@AsyncFunction promise.resolve(false)
      val request = VpnService.prepare(context) ?: return@AsyncFunction promise.resolve(true)
      val activity = appContext.currentActivity ?: return@AsyncFunction promise.resolve(false)
      consent?.resolve(false)
      consent = promise
      activity.startActivityForResult(request, CONSENT_REQUEST)
    }

    AsyncFunction("start") { settings: FilterSettingsRecord ->
      if (!available() || VpnService.prepare(context) != null) return@AsyncFunction false
      // Settings that cannot be read are not overwritten: the app reports a failed start.
      FilterConfigStore.of(context).turnOn(settings.youtube, settings.notification.toText()) ?: return@AsyncFunction false
      FilterVpnService.start(context, "app-start")
      true
    }

    // Keeps the notification's words in the language of the app, for the starts without it too.
    AsyncFunction("describe") { words: FilterNotificationRecord ->
      if (!available()) return@AsyncFunction
      val text = words.toText() ?: return@AsyncFunction
      FilterConfigStore.of(context).describe(text) ?: return@AsyncFunction
      FilterNotification.update(context, text, FilterStatus.running)
    }

    AsyncFunction("stop") {
      if (available()) {
        // Settings that cannot be read are not overwritten, and the filter stays on.
        FilterConfigStore.of(context).turnOff() ?: throw UnreadableSettingsException()
        FilterVpnService.stop(context)
      }
    }

    // Brings the tunnel back when flust opens, after Android refused to start it at boot or
    // stopped the app. Resolves once the tunnel runs, or after a short wait, so the status the app
    // reads next is not the one from before the start.
    AsyncFunction("resume") { promise: Promise ->
      if (!available() || FilterStatus.running) return@AsyncFunction promise.resolve(false)
      if (!FilterConfigStore.of(context).load().enabled || VpnService.prepare(context) != null) {
        return@AsyncFunction promise.resolve(false)
      }
      FilterVpnService.start(context, "app-resume")
      whenRunning(SystemClock.elapsedRealtime() + RESUME_WAIT_MILLIS) { promise.resolve(true) }
    }

    // The size of the compiled lists, the time to load them, the mean time to match a name and
    // the phases of the last tunnel start in this process, shown in the development build only.
    AsyncFunction("measure") {
      val started = SystemClock.elapsedRealtimeNanos()
      val bytes = context.assets.open(FilterVpnService.LISTS_ASSET).use { it.readBytes() }
      val lists = Blocklist.read(bytes)
      val loaded = SystemClock.elapsedRealtimeNanos()
      val policy = FilterPolicy(lists, FilterConfig(enabled = true))
      val names = List(MEASURED_NAMES) { "cdn$it.static$it.example$it.com" }
      val matchStarted = SystemClock.elapsedRealtimeNanos()
      names.forEach(policy::decide)
      val matched = SystemClock.elapsedRealtimeNanos()
      mapOf(
        "entries" to lists.size,
        "bytes" to bytes.size,
        "loadMillis" to (loaded - started) / 1_000_000.0,
        "decideMicros" to (matched - matchStarted) / 1_000.0 / MEASURED_NAMES,
        "resolver" to FilterStatus.activeResolver(),
        "start" to FilterStatus.lastStart?.let { start ->
          mapOf(
            "listsMillis" to start.listsMillis,
            "listsCached" to start.listsCached,
            "trustMillis" to start.trustMillis,
            "establishMillis" to start.establishMillis,
            "totalMillis" to start.totalMillis,
          )
        },
      )
    }

    // The activity's end is often the last call before a manufacturer kills flust from recents.
    OnActivityDestroys {
      val context = appContext.reactContext ?: return@OnActivityDestroys
      if (available() && FilterConfigStore.of(context).load().enabled) {
        FilterRestartJob.scheduleSoon(context, "activity-destroyed")
      }
    }

    OnActivityResult { _: Activity, payload ->
      if (payload.requestCode != CONSENT_REQUEST) return@OnActivityResult
      consent?.resolve(payload.resultCode == Activity.RESULT_OK)
      consent = null
    }
  }

  private fun whenRunning(deadline: Long, done: () -> Unit) {
    if (FilterStatus.running || SystemClock.elapsedRealtime() >= deadline) return done()
    main.postDelayed({ whenRunning(deadline, done) }, RESUME_POLL_MILLIS)
  }

  // The manifest does not change while the app runs.
  private var declared: Boolean? = null

  private fun available(): Boolean = declared ?: serviceDeclared().also { declared = it }

  private fun serviceDeclared(): Boolean =
    try {
      context.packageManager.getServiceInfo(ComponentName(context, FilterVpnService::class.java), 0)
      true
    } catch (missing: PackageManager.NameNotFoundException) {
      false
    }

  private companion object {
    const val CONSENT_REQUEST = 0x464c
    const val MEASURED_NAMES = 20_000
    const val RESUME_WAIT_MILLIS = 3_000L
    const val RESUME_POLL_MILLIS = 100L
  }
}

private class UnreadableSettingsException : CodedException("The filter settings cannot be read")
