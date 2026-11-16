# 0030 Production Android permissions

## Context

flust makes no network calls ([0006](0006-no-network-access.md)), yet its Android builds request `INTERNET` and other permissions it does not use. They come from the Expo prebuild template, from libraries' manifests, and from manifests that only apply to debug builds. A permission that is never used still widens what the app could do if a dependency changed, and what a store listing says about it. The development build needs some of them to load JavaScript from Metro over the network.

Where each one comes from:

| Permission                    | Source                                                                                                                                                          | Needed by                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `INTERNET`                    | The Expo template's main manifest (`expo/template.tgz`), and `expo-file-system`'s library manifest, for its download and upload APIs.                           | The development build, to reach Metro.  |
| `SYSTEM_ALERT_WINDOW`         | The Expo template's main manifest, and React Native's `debug` and `debugOptimized` manifests, for the developer overlays (red box, performance monitor).        | Debug builds only.                      |
| `WRITE_EXTERNAL_STORAGE`      | The Expo template's main manifest (up to API 32), and `expo-file-system`'s library manifest, for its legacy APIs. flust only writes inside its own app storage. | Nothing.                                |
| `ACCESS_NETWORK_STATE`        | `expo-dev-launcher`'s `debug` manifest.                                                                                                                         | The development build's server list.    |
| `CHANGE_WIFI_MULTICAST_STATE` | `expo-dev-launcher`'s `debug` manifest, to find development servers on the local network.                                                                       | The development build.                  |
| `ACCESS_LOCAL_NETWORK`        | React Native's `debug` and `debugOptimized` manifests: Android 17 asks for it to reach a development server on the local network.                               | Debug builds that use Metro over Wi-Fi. |

`READ_EXTERNAL_STORAGE` and `USE_FINGERPRINT` are already blocked in every variant ([0025](0025-screen-privacy.md)). `VIBRATE`, from the template, is kept: reminders may need it to vibrate on Android versions before notification channels.

## Decision

- `app.config.ts` adds the six permissions above to `android.blockedPermissions` when `APP_VARIANT` is `production`, which is also the default. Expo then writes `tools:node="remove"` entries that remove them from the merged manifest, whichever library declares them. The development variant keeps them.
- The list is `PRODUCTION_BLOCKED_PERMISSIONS` in `app.config.ts`. `scripts/check-android-release.sh` holds the same list, which a test compares, lists the merged permissions of a build, and fails when one of them is still there. An APK is read with `aapt2`, from the Android SDK's build tools; a bundle's protobuf manifest is searched as text.
- A test parses every TypeScript and JavaScript source with the TypeScript compiler and fails on `fetch`, `XMLHttpRequest`, `WebSocket` or `EventSource`, outside the test setup that blocks them. It searches Kotlin and Swift sources for the platform network APIs (`java.net`, OkHttp, `HttpURLConnection`, sockets, `WebView`, `URLSession`, `URLRequest`, the Network framework, `WKWebView`). ESLint also rejects the four globals in `src/`.

## Consequences

- A production build cannot open a network connection, even through a dependency: Android refuses sockets to an app without `INTERNET`.
- The block covers release builds. In a debug build of the production variant, the template's own `src/debug` manifest ranks above the main one in the manifest merge and keeps `SYSTEM_ALERT_WINDOW`; nothing ships from that build.
- A production-variant build cannot load JavaScript from Metro. Work that needs Metro uses the development variant.
- Links to the website, the source code and findahelpline.com still open: the browser or the app that handles them makes the connection, not flust.
- A new dependency that adds a permission shows up in the release check's list, and fails it if the permission is one of these.
- The debug APK contains Google Play services, ML Kit and Firebase component classes, which `expo-dev-launcher` brings for its QR code scanner. The release classpath has none; the release check proves it on each build ([0021](0021-local-notifications.md)).
