# Release

The checks before each store release, in order. A release that fails one is not submitted.

1. `main` is green in CI, every job of the three workflows ([Testing](testing.md#ci)), the native builds included: the Android check and the iOS URL type check have passed on a production build of the release commit.
2. The builds come from the `production` profile on EAS (see [Setup](setup.md#development-build)).
3. The Android build contains no Firebase, Google Play services or Install Referrer code, and no manifest entries for them ([0021](../decisions/0021-local-notifications.md)). It requests the expected permissions only, none of those blocked in production ([0030](../decisions/0030-production-android-permissions.md)). It registers no URL scheme: no intent filter with a `VIEW` action and a data scheme ([0035](../decisions/0035-no-url-scheme-in-production.md)). Run the check on the bundle EAS produced, with `BUNDLETOOL` set (see [Setup](setup.md#android-build-tools)):

       scripts/check-android-release.sh path/to/flust.aab

   CI already runs it on a release APK built from each change to a native path; this run is on what EAS built. It lists the permissions the build requests. It exits with 1 and lists what it found when the build has something it must not ship, including a permission outside the expected list or a URL scheme, and with 2 when it cannot read the build. A new permission is either blocked, or added to `PRODUCTION_ANDROID_PERMISSIONS` in `app.config.ts` and to the script, with a reason.

4. Every help number was checked against its official sources within the last 400 days, which the review test enforces. Check them again every year ([0027](../decisions/0027-offline-help-resources.md)).
5. The Maestro flows pass on a local production release APK built from the release commit ([Testing](testing.md#end-to-end)), and the [manual checklist](manual-checklist.md) is done for the platforms being released.
6. The release goes out as a phased rollout on both stores ([Scenarios](../product/scenarios.md#production-incidents)).

## Local production build

To check a production build before EAS, or after a dependency change, build a release APK in the distrobox. It needs the Android SDK and the JDK set up as described in [Setup](setup.md#android-build-tools).

1. Generate the native project for the production variant. `--clean` deletes `android/` first, so local changes there are lost, which is expected since it is generated:

       APP_VARIANT=production pnpm expo prebuild --platform android --clean

2. Build the release APK. Gradle downloads its dependencies, and the NDK and CMake versions it needs into the SDK, the first time. The template signs the release build with the debug key: the APK installs on a test device, but is not for the stores.

       (cd android && ./gradlew assembleRelease)

3. Run the check on it. It prints every permission the build requests, then fails on Firebase or Google Play services code, a blocked permission, an unexpected one, a URL scheme, or a build without the content filter's VPN service and its two permissions:

       scripts/check-android-release.sh android/app/build/outputs/apk/release/app-release.apk

   To see the permissions with their attributes, such as `maxSdkVersion`, `aapt2` lists them directly:

       "$ANDROID_HOME"/build-tools/<version>/aapt2 dump permissions android/app/build/outputs/apk/release/app-release.apk

4. Optionally install it with `adb install -r`, next to the development build, which has its own identifier. It runs from its bundled JavaScript only: its `INTERNET` permission serves the content filter, and nothing loads JavaScript from Metro in a release build.

5. Go back to the development variant before working with Metro again:

       APP_VARIANT=development pnpm expo prebuild --platform android --clean

## Local iOS build

On a Mac with Xcode and CocoaPods, the same build as the `ios-build` job:

    APP_VARIANT=production pnpm expo prebuild --platform ios --clean --no-install
    (cd ios && pod install)
    (cd ios && xcodebuild build -workspace flust.xcworkspace -scheme flust -configuration Release \
      -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath build CODE_SIGNING_ALLOWED=NO)
    scripts/check-ios-release.sh ios/build/Build/Products/Release-iphonesimulator/flust.app

The script exits with 1 when the app registers a URL scheme, and with 2 when it cannot read the build.
