# 0025 Screen privacy

## Context

Screenshots and the app switcher's preview can show what flust holds to someone who did not open it. Developers need screenshots of the development build.

On Android, `expo-screen-capture` registers a screenshot observer as soon as it loads. From Android 14, that needs `DETECT_SCREEN_CAPTURE`, which flust has no use for: with the permission blocked, the app crashes on launch.

## Decision

- In production builds, the app is protected at launch, one file per platform:
  - iOS: `expo-screen-capture` blurs the app switcher preview (`privacy-screen.ios.ts`).
  - Android: `modules/flust-privacy` sets `FLAG_SECURE` on the activity window, on the UI thread, which hides the app in recents and blocks screenshots and screen recording (`privacy-screen.android.ts`). The module sets it again on each activity that comes to the foreground, so a recreated activity stays protected.
- `expo-screen-capture` is excluded from Android autolinking (`expo.autolinking.android.exclude` in `package.json`), so its observer, its code and its manifest permissions are not in the Android build.
- The development variant (`APP_VARIANT=development`) leaves the protection off. `app.config.ts` sets `extra.screenPrivacy`, which the app reads at launch.
- `android.blockedPermissions` removes `READ_EXTERNAL_STORAGE`, which `expo-file-system` merges and flust does not use, and `USE_FINGERPRINT`, merged by `expo-local-authentication`, which `USE_BIOMETRIC` replaces.
- Lint allows `expo-screen-capture` only in `privacy-screen.ios.ts`.

## Consequences

- People cannot screenshot their own progress in production, to share it or keep it. That is the price of the protection, and may be revisited with an explicit share feature.
- On Android, flust keeps its own few lines for `FLAG_SECURE` instead of a library update.
- The lock cover ([0023](0023-app-lock.md)) is drawn by the app after it leaves the foreground, too late for the iOS snapshot and the Android recents thumbnail. Only this protection hides those, so the development build shows its content there.
