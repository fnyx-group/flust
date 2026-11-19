package org.fnyxgroup.flust.privacy

import android.content.Context
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

// Found by Expo autolinking, which loads every *Package class of a module. The listener acts as
// the activity is created, before JavaScript runs and before the first frame.
class FlustPrivacyPackage : Package {
  override fun createReactActivityLifecycleListeners(
    activityContext: Context,
  ): List<ReactActivityLifecycleListener> = listOf(ActivityPrivacy())
}
