package org.fnyxgroup.flust.filter

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.SystemClock
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class FilterSettingsRecord : Record {
  @Field val adult: Boolean = true
  @Field val aiNudify: Boolean = true
  @Field val aiCompanions: Boolean = false
  @Field val strict: Boolean = true
  @Field val youtubeStrict: Boolean = false
  @Field val exceptions: List<String> = emptyList()

  fun toConfig(enabled: Boolean) = FilterConfig(
    enabled = enabled,
    adult = adult,
    aiNudify = aiNudify,
    aiCompanions = aiCompanions,
    strict = strict,
    youtube = if (youtubeStrict) YouTubeLevel.STRICT else YouTubeLevel.MODERATE,
    exceptions = exceptions.mapNotNull(FilterConfig::exceptionName).toSet(),
  )
}

// The bridge to the filter. In the builds where the VPN service is not declared, every call
// reports the filter as unavailable and starts nothing.
class FlustFilterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.AppContextLost()

  private var consent: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("FlustFilter")

    Function("getStatus") {
      val config = FilterConfigStore(context).load()
      mapOf(
        "available" to available(),
        "consent" to (available() && VpnService.prepare(context) == null),
        "running" to FilterStatus.running,
        "stopReason" to FilterStatus.stopReason(context),
        "enabled" to config.enabled,
        "adult" to config.adult,
        "aiNudify" to config.aiNudify,
        "aiCompanions" to config.aiCompanions,
        "strict" to config.strict,
        "youtubeStrict" to (config.youtube == YouTubeLevel.STRICT),
        "exceptions" to config.exceptions.sorted(),
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
      FilterConfigStore(context).save(settings.toConfig(enabled = true))
      FilterVpnService.start(context)
      true
    }

    AsyncFunction("stop") {
      val store = FilterConfigStore(context)
      store.save(store.load().copy(enabled = false))
      if (available()) FilterVpnService.stop(context)
    }

    // Brings the tunnel back when flust opens, after Android refused to start it at boot or
    // stopped the app.
    AsyncFunction("resume") {
      if (!available() || FilterStatus.running) return@AsyncFunction false
      if (!FilterConfigStore(context).load().enabled || VpnService.prepare(context) != null) {
        return@AsyncFunction false
      }
      FilterVpnService.start(context)
      true
    }

    // The size of the compiled lists, the time to load them and the mean time to match a name,
    // for the development setting.
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
      )
    }

    OnActivityResult { _: Activity, payload ->
      if (payload.requestCode != CONSENT_REQUEST) return@OnActivityResult
      consent?.resolve(payload.resultCode == Activity.RESULT_OK)
      consent = null
    }
  }

  private fun available(): Boolean =
    try {
      context.packageManager.getServiceInfo(ComponentName(context, FilterVpnService::class.java), 0)
      true
    } catch (missing: PackageManager.NameNotFoundException) {
      false
    }

  private companion object {
    const val CONSENT_REQUEST = 0x464c
    const val MEASURED_NAMES = 20_000
  }
}
