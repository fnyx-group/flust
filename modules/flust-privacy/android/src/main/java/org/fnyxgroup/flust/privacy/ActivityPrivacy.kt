package org.fnyxgroup.flust.privacy

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.WindowManager
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class ActivityPrivacy : ReactActivityLifecycleListener {
  private var keyboard: NoPersonalizedLearning? = null

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    if (screenPrivacyOn(activity)) {
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
    keyboard = NoPersonalizedLearning(activity.window.decorView).also { it.attach() }
  }

  override fun onDestroy(activity: Activity) {
    keyboard?.detach()
    keyboard = null
  }

  // Written by plugins/with-screen-privacy.ts: false in the development build only. A value that
  // cannot be read keeps the protection.
  private fun screenPrivacyOn(activity: Activity): Boolean {
    val metaData = try {
      activity.packageManager
        .getApplicationInfo(activity.packageName, PackageManager.GET_META_DATA)
        .metaData
    } catch (error: PackageManager.NameNotFoundException) {
      null
    }
    return metaData?.getBoolean(SCREEN_PRIVACY_META_DATA, true) ?: true
  }

  companion object {
    private const val SCREEN_PRIVACY_META_DATA = "org.fnyxgroup.flust.privacy.SCREEN_PRIVACY"
  }
}
