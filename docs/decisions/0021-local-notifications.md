# 0021 Local notifications

## Context

Reminders ([Features](../product/features.md#reminders)) are planned on the device and never come from a server ([0006](0006-no-network-access.md)). On Android, `expo-notifications` links Firebase Cloud Messaging even when only local notifications are used, and its dependency `expo-application` links the Play Install Referrer library. Both would ship Google code that can reach the network in an app that promises to send nothing.

On iOS, `expo-notifications` only uses the system's `UNUserNotificationCenter` for local notifications. Push needs an `aps-environment` entitlement, which its config plugin adds unless `enableRemoteNotifications` is false.

## Decision

- A `Notifier` interface (`src/features/reminders/notifier-types.ts`) with one file per platform: `notifier.ios.ts` uses `expo-notifications`, `notifier.android.ts` uses the local `flust-reminders` module, and `notifier.ts` does nothing on the web.
- iOS: the plugin is listed in `app.json` with `enableRemoteNotifications: false`, so the build has no `aps-environment` entitlement and no remote-notification background mode. Lint allows `expo-notifications` only in `notifier.ios.ts` and forbids its push functions there.
- Android: `expo-notifications` and `expo-application` are excluded from autolinking (`expo.autolinking.android.exclude` in `package.json`). No Firebase plugin, no `google-services.json`, no C2DM entry.
- `modules/flust-reminders` (Kotlin):
  - Alarms are set with `AlarmManager.setAndAllowWhileIdle`, which is inexact and needs no exact-alarm permission.
  - One channel, "Reminders", with default importance and `VISIBILITY_PRIVATE`, so the lock screen shows only that flust sent something.
  - The planned list is a JSON file in `noBackupFilesDir`, written by atomic rename.
  - On `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIMEZONE_CHANGED` and `TIME_SET`, every reminder is set again. Floating reminders are converted from their stored wall time with the current zone (`WallTime.kt`, ported from `localToUtc`, [0013](0013-local-time-to-utc.md)). Fixed ones keep their instant.
  - The permission state, the `POST_NOTIFICATIONS` request on Android 13 and later, and taps are exposed to JS. A tap carries only a route, checked against `NOTIFICATION_ROUTES` before use.
  - Both receivers are not exported.
- Kotlin unit tests cover the wall-time conversion and the rescheduling rules.

## Consequences

- The Android release build must contain no `com.google.firebase` or `com.google.android.gms` classes and no Firebase manifest entries. This is checked with `apkanalyzer` before each release.
- Android reminders can arrive a few minutes late, and Doze can batch them. That is fine for a check-in or a thought.
- The module has its own code to maintain, and Kotlin tests that need a JDK and the Android SDK to run.
- A future feature that needs push would need a new decision, not just a flag.
