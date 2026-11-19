# Release

The checks before each store release, in order. A release that fails one is not submitted.

1. `main` is green in CI: typecheck, tests with coverage, lint, knip, format check, and the Kotlin tests.
2. The builds come from the `production` profile on EAS (see [Setup](setup.md#development-build)).
3. The Android build contains no Firebase, Google Play services or Install Referrer code, and no manifest entries for them ([0021](../decisions/0021-local-notifications.md)). It requests the expected permissions only, none of those blocked in production ([0030](../decisions/0030-production-android-permissions.md)). It registers no URL scheme: no intent filter with a `VIEW` action and a data scheme ([0035](../decisions/0035-no-url-scheme-in-production.md)). Run the check on the bundle EAS produced, with `BUNDLETOOL` set (see [Setup](setup.md#android-build-tools)):

       scripts/check-android-release.sh path/to/flust.aab

   It lists the permissions the build requests. It exits with 1 and lists what it found when the build has something it must not ship, including a permission outside the expected list or a URL scheme, and with 2 when it cannot read the build. A new permission is either blocked, or added to `PRODUCTION_ANDROID_PERMISSIONS` in `app.config.ts` and to the script, with a reason.

4. Every help number was checked against its official sources within the last 400 days, which the review test enforces. Check them again every year ([0027](../decisions/0027-offline-help-resources.md)).
5. The Maestro flows pass on a local production release APK built from the release commit ([Testing](testing.md#end-to-end)), and the [manual checklist](manual-checklist.md) is done for the platforms being released.
6. The release goes out as a phased rollout on both stores ([Scenarios](../product/scenarios.md#production-incidents)).

## Local production build

To check a production build before EAS, or after a dependency change, build a release APK in the distrobox. It needs the Android SDK and the JDK set up as described in [Setup](setup.md#android-build-tools).

1. Generate the native project for the production variant. `--clean` deletes `android/` first, so local changes there are lost, which is expected since it is generated:

       APP_VARIANT=production pnpm expo prebuild --platform android --clean

2. Build the release APK. Gradle downloads its dependencies, and the NDK and CMake versions it needs into the SDK, the first time. The template signs the release build with the debug key: the APK installs on a test device, but is not for the stores.

       (cd android && ./gradlew assembleRelease)

3. Run the check on it. It prints every permission the build requests, then fails on Firebase or Google Play services code, a blocked permission, an unexpected one or a URL scheme:

       scripts/check-android-release.sh android/app/build/outputs/apk/release/app-release.apk

   To see the permissions with their attributes, such as `maxSdkVersion`, `aapt2` lists them directly:

       "$ANDROID_HOME"/build-tools/<version>/aapt2 dump permissions android/app/build/outputs/apk/release/app-release.apk

4. Optionally install it with `adb install -r`, next to the development build, which has its own identifier. Without `INTERNET`, it runs from its bundled JavaScript only.

5. Go back to the development variant before working with Metro again:

       APP_VARIANT=development pnpm expo prebuild --platform android --clean
