# 0035 No URL scheme in production

## Context

The production build registered the `flust://` scheme: an intent filter on the main activity on Android, a URL type in the `Info.plist` on iOS, and the bundle identifier as a second iOS scheme. expo-dev-client also added `exp+flust` to the main Android manifest, so it shipped in release builds too.

Any web page can try to open a scheme and see whether something answers, which tells it that flust is installed. A link such as `flust://emergency` also mounted the emergency screen, which records an urge, without the person asking. Nothing in flust needs a scheme: notification taps carry their route in an intent extra on Android and in the notification data on iOS ([0021](0021-local-notifications.md)).

## Decision

- Production builds register no URL scheme. `plugins/with-no-url-scheme.ts`, applied to the production variant only, removes every intent filter with a `VIEW` action and a data scheme from the activities of the Android manifest, and `CFBundleURLTypes` from the iOS `Info.plist`. It runs as a finalized mod, after Expo's own scheme plugin and expo-dev-client's, which add their schemes later than the plugins of `app.config.ts`.
- The `<queries>` entry for `https`, which lets flust open the help links in the browser, stays: it declares what flust may open, not what opens flust.
- `scheme` stays in the JavaScript config, because expo-linking reads it at run time. It can go once a release build shows that nothing needs it.
- The development build keeps `flust-dev`, which the dev client is opened with.
- `scripts/check-android-release.sh` fails on any intent filter with a `VIEW` action and a data scheme. In an APK, a scheme or action given as a resource reference is not resolved: the check fails on it rather than miss it.
- As a second line of defense, `+native-intent.tsx` sends a link that launches the app to home and ignores a link that arrives while the app runs. A link that arrives while the app runs could otherwise close a note being written, so it is not sent to home either. Links are no longer held while the app is locked: only notification taps are ([0023](0023-app-lock.md)).
- A route that does not exist shows `+not-found.tsx`, in the app's style, with a way back home.

## Consequences

- No web page or other app can detect flust through a scheme, or open one of its screens.
- Sharing a link into flust, or a widget that opens a screen, would need this decision revisited, for example with verified App Links bound to a domain.
- `scripts/check-ios-release.sh` fails on a `CFBundleURLTypes` in the `Info.plist` of the built app. CI runs it on a production simulator build ([0037](0037-ci-native-builds.md)). That opening `flust://emergency` in Safari does nothing is still checked by hand ([Manual checklist](../development/manual-checklist.md#ios)).
