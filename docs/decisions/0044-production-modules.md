# 0044 Development modules out of production

## Context

`expo-dev-client` is a dependency of the app, so autolinking linked it into every variant, with `expo-dev-launcher`, `expo-dev-menu` and the modules only they depend on, `expo-dev-menu-interface`, `expo-manifests`, `expo-json-utils` and `expo-updates-interface`. `@expo/dom-webview`, an optional peer of `expo` that only DOM components use, was linked too. The production APK carried their classes, some of them after R8, and the Licenses screen listed them ([0043](0043-third-party-licenses.md)). flust has no DOM component, and nothing in production opens the development client.

The exclusions of `package.json` (`expo.autolinking.android.exclude`) apply to every variant, and the development build needs the development client.

## Decision

- `plugins/with-production-modules.ts`, applied to the production variant only, writes `expoAutolinking.exclude` with these modules into the generated `settings.gradle`, before `expoAutolinking.useExpoModules()`. The Gradle plugin passes them to autolinking, which adds them to the exclusions of `package.json`.
- The plugin fails the prebuild when `settings.gradle` does not call `useExpoModules()` exactly once, rather than ship the modules without notice.
- `scripts/check-android-release.sh` fails on a build whose dex holds a class of these modules' Java packages, `expo.modules.devclient`, `devlauncher`, `devmenu`, `manifests`, `jsonutils`, `updatesinterface` and `webview`. `expo-dev-menu-interface` has no Android code.
- Android only for now. The iPhone build gets the same exclusion with lot 3, when its native project is generated.

## Consequences

- The production APK holds no class of these modules, and the Licenses screen no longer lists them.
- A DOM component, or any production use of these modules, needs this list changed first: the production build would fail to find the native module at run time.
- A new module that only the development client brings in is linked into production until it is added to the list. The Licenses screen shows it in review, since its file is regenerated from the production APK.
