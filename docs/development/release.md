# Release

The checks before each store release, in order. A release that fails one is not submitted.

1. `main` is green in CI: typecheck, tests with coverage, lint, knip, format check, and the Kotlin tests.
2. The builds come from the `production` profile on EAS (see [Setup](setup.md#development-build)).
3. The Android build contains no Firebase, Google Play services or Install Referrer code, and no manifest entries for them ([0021](../decisions/0021-local-notifications.md)), and none of the permissions blocked in production ([0030](../decisions/0030-production-android-permissions.md)). Run the check on the APK or the bundle EAS produced:

       scripts/check-android-release.sh path/to/flust.aab

   It lists the merged permissions, exits with an error and lists what it found. Check the list against the previous release: any new permission needs a reason.

4. Every help number was checked against its official sources within the last 400 days, which the review test enforces. Check them again every year ([0027](../decisions/0027-offline-help-resources.md)).
5. The release goes out as a phased rollout on both stores ([Scenarios](../product/scenarios.md#production-incidents)).

## Local production build

To check a production build before EAS, or after a dependency change, build a release APK in the distrobox. It needs the Android SDK (`ANDROID_HOME`, with build tools, which hold `aapt2`) and Java 17.

1. Generate the native project for the production variant. `--clean` deletes `android/` first, so local changes there are lost, which is expected since it is generated:

       APP_VARIANT=production pnpm expo prebuild --platform android --clean

2. Build the release APK. Gradle downloads its dependencies the first time. The template signs the release build with the debug key: the APK installs on a test device, but is not for the stores.

       (cd android && ./gradlew assembleRelease)

3. Run the check on it. It prints every permission in the merged manifest, then fails on Firebase or Google Play services code or a blocked permission:

       scripts/check-android-release.sh android/app/build/outputs/apk/release/app-release.apk

   To see the permissions with their attributes, such as `maxSdkVersion`, `aapt2` lists them directly:

       "$ANDROID_HOME"/build-tools/<version>/aapt2 dump permissions android/app/build/outputs/apk/release/app-release.apk

   A production build should request `USE_BIOMETRIC`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` and flust's own `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, and nothing else.

4. Optionally install it with `adb install -r`, next to the development build, which has its own identifier. Without `INTERNET`, it runs from its bundled JavaScript only.

5. Go back to the development variant before working with Metro again:

       APP_VARIANT=development pnpm expo prebuild --platform android --clean
