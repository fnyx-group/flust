# 0025 Screen privacy

## Context

Screenshots and the app switcher's preview can show what flust holds to someone who did not open it. Developers need screenshots of the development build.

## Decision

- In production builds, `expo-screen-capture` prevents screenshots and screen recording (`FLAG_SECURE` on Android) and blurs the iOS app switcher preview (`privacy-screen.ts`).
- The development variant (`APP_VARIANT=development`) leaves both off. `app.config.ts` sets `extra.screenPrivacy`, which the app reads at launch.
- The permissions `expo-screen-capture` merges for screenshot detection (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `DETECT_SCREEN_CAPTURE`) are removed with `android.blockedPermissions`, since flust does not detect screenshots. `USE_FINGERPRINT`, merged by `expo-local-authentication`, is removed too: `USE_BIOMETRIC` replaces it.
- Lint allows `expo-screen-capture` only in `privacy-screen.ts`.

## Consequences

- People cannot screenshot their own progress in production, to share it or keep it. That is the price of the protection, and may be revisited with an explicit share feature.
- The lock cover ([0023](0023-app-lock.md)) is drawn by the app after it leaves the foreground, too late for the iOS snapshot and the Android recents thumbnail. Only this protection hides those, so the development build shows its content there.
