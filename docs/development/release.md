# Release

The checks before each store release, in order. A release that fails one is not submitted.

1. `main` is green in CI, every job of the three workflows ([Testing](testing.md#ci)), the native builds included: the Android check, on the release APK and on the bundle, and the iOS URL type check have passed on a production build of the release commit.
2. The version is raised in `app.json`: `expo.version` for the user, and for Android `expo.android.versionCode`, a whole number greater than the one of the last upload to Google Play, at most 2,100,000,000. The release check fails on a build whose version differs from `app.json`.
3. The Android bundle for Google Play is built and checked locally from the release commit, signed with the upload key: see [Android bundle](#android-bundle). The iPhone build comes from the `production` profile on EAS (see [Setup](setup.md#development-build)).
4. The Android bundle passes the release check, which `scripts/build-android-bundle.sh` runs:
   - The build contains no Firebase, Google Play services or Install Referrer code, and no manifest entries for them ([0021](../decisions/0021-local-notifications.md)).
   - It requests the expected permissions only, none of those blocked in production ([0030](../decisions/0030-production-android-permissions.md)).
   - It registers no URL scheme, meaning no intent filter with a `VIEW` action and a data scheme ([0035](../decisions/0035-no-url-scheme-in-production.md)).
   - It is what Google Play accepts: the production package, not debuggable, the target API level Play requires, the version of `app.json`, the native libraries of the four ABIs, uncompressed and aligned for 16 KB pages in the 64-bit ones, and the R8 mapping and native symbols in the bundle. It is signed with the upload key, whose certificate the check knows by its SHA-256 ([0046](../decisions/0046-android-bundle-and-upload-key.md)).
   - Its universal APK passes the same checks, and the Licenses screen lists what it ships: every dependency has its text and a license allowed by `scripts/licenses/allowed.ts` ([0043](../decisions/0043-third-party-licenses.md)).

   The check lists the permissions the build requests, the 32-bit native libraries not aligned for 16 KB pages, which it does not fail on, and prints the signer. It exits with 1 and lists what it found when the build has something it must not ship, and with 2 when it cannot read the build. A new permission is either blocked, or added to `PRODUCTION_ANDROID_PERMISSIONS` in `app.config.ts` and to the script, with a reason.

5. Every help number was checked against its official sources within the last 400 days, which the review test enforces. Check them again every year ([0027](../decisions/0027-offline-help-resources.md)).
6. The Maestro flows and the full layout matrix (`scripts/e2e-android.sh --full-matrix`) pass on the field APK of the release bundle ([Testing](testing.md#end-to-end)), and the [manual checklist](manual-checklist.md) is done for the platforms being released.
7. The release goes out as a phased rollout on both stores ([Scenarios](../product/scenarios.md#production-incidents)).

## Upload key

Google Play signs the APKs it delivers with an app signing key that Google generates and holds (Play App Signing). Each bundle sent to Play is signed with the upload key, which only the maintainer has. Neither key, nor its passwords, ever goes into the repository: `.gitignore` covers `*.jks`, `*.keystore` and `keystore.properties`, but the keystore belongs outside the repository anyway.

Once, before the first upload:

1. Create the keystore outside the repository, with an RSA key of 4,096 bits valid for about 27 years. `keytool` asks for a password and the certificate's name fields. A PKCS12 keystore uses its store password for the key too:

       mkdir -p ~/.config/flust && chmod 700 ~/.config/flust
       keytool -genkeypair -v -storetype PKCS12 -keystore ~/.config/flust/flust-upload.jks \
         -alias flust-upload -keyalg RSA -keysize 4096 -validity 10000

2. Keep the password in a password manager. Back up the keystore to an encrypted medium kept offline, apart from the computer. If the key is lost or leaked, Google Play can register a new upload key on request. Apps already installed are not affected, since the app signing key does not change.
3. Write the certificate's SHA-256 into `upload_certificate_sha256` of `scripts/check-android-release.sh`, in place of the placeholder, and commit it. A certificate fingerprint is public. Until then, `--upload` fails on every bundle:

       keytool -list -v -keystore ~/.config/flust/flust-upload.jks -alias flust-upload | grep SHA256:

4. Tell the build script where the keystore is, in the shell profile or before each release. It refuses a keystore inside the repository:

       export FLUST_UPLOAD_KEYSTORE="$HOME/.config/flust/flust-upload.jks"

   The alias is `flust-upload`, or `$FLUST_UPLOAD_KEY_ALIAS`. The passwords are never written down for the build: `scripts/build-android-bundle.sh --upload` asks for them, and gives them to its one Gradle run through that run's environment, with `--no-daemon`, so that no Gradle process keeps them once the build ends. Never put them in `gradle.properties` or a `flustUpload*` variable: the build signs with the upload key only when the script passes `-PflustRequireUploadKey=true`, and fails then if any of the four `flustUpload*` properties is missing.

In the distrobox, `~` is the container's home folder.

## Android bundle

The bundle comes from the production prebuild and the same release build type as the release APK: the same R8 settings, resources, JavaScript bundle and filter lists. It differs in how it is packaged, not in what it holds. Google Play splits it into APKs by ABI, screen density and language, signs them with the app signing key, and keeps the R8 mapping and native symbols that the bundle carries in `BUNDLE-METADATA/`.

It needs the [Android build tools](setup.md#android-build-tools), bundletool included.

1. With `FLUST_UPLOAD_KEYSTORE` set (step 4 above), from a clean working tree on the release commit:

       scripts/build-android-bundle.sh --upload --field-apk

   It asks for the keystore and key passwords (Enter for the key when it shares the keystore's), then:
   - refuses a working tree with changes, and any `.env*` file at the root of the repository, which Git ignores and Expo loads into the build: move it out for the release;
   - runs `pnpm install --frozen-lockfile --offline`, so that `node_modules` is what `pnpm-lock.yaml` says, and refuses a working tree the install changed;
   - runs the production prebuild, then `./gradlew --no-daemon bundleRelease` for the four ABIs, `armeabi-v7a`, `arm64-v8a`, `x86` and `x86_64`, given on the command line so that a `reactNativeArchitectures` of `~/.gradle/gradle.properties` cannot leave one out;
   - runs `scripts/check-android-release.sh --upload` on the bundle. The check also builds the bundle's universal APK, runs every APK check on it, and checks the Licenses screen against it.

   When anything fails, it deletes the upload-signed bundle in `android/` and every `.partial` folder of the release folder, so that the only upload-signed bundle is a complete archive.

2. It keeps the build in a new folder of `~/flust-releases`, or of `$FLUST_RELEASE_DIR`, outside the repository, since the next prebuild deletes `android/`. The folder is named after the version, the commit and the time, and gets that name only once every file is in it. Keep it for as long as the release can send crash reports:
   - `flust-<version>-<versionCode>-upload.aab`, the bundle to upload.
   - `-mapping.txt` and `-native-debug-symbols.zip`, which Play already reads from the bundle. They are kept in case Play asks for them again, and to read a stack trace locally.
   - `-index.android.bundle.map`, the JavaScript source map.
   - `-field.apk`, with `--field-apk`.
   - `SHA256SUMS`, the hashes of all of them.

3. Upload the `.aab` to Google Play Console.

Without `--upload`, the same script builds a bundle signed with the template's debug key, from a working tree with changes too, for local checks and field tests. It neither asks for passwords nor runs the install. Its files end in `-debug-signed`, and the folder name in `-dirty` when the tree had changes. The check fails on any other signer than the debug key, matched by its SHA-256, and Google Play refuses the bundle.

### Field tests

`--field-apk` turns the checked bundle into its universal APK, which holds every ABI, density and language, signed with the debug key of the generated project, the same as the local release APK. Install it on a phone or the emulator, and run the Maestro flows on it:

    adb install -r ~/flust-releases/<folder>/flust-<version>-<versionCode>-field.apk
    scripts/e2e-android.sh --apk ~/flust-releases/<folder>/flust-<version>-<versionCode>-field.apk

The field APK and the Google Play build have different signers: Android refuses to install one over the other. Moving a phone from one to the other needs an uninstall, which deletes all of flust's local data, with no way to recover it. Tell field testers before they install it, and use test data only.

## Local production build

To check a production build after a dependency change, build a release APK in the distrobox. It needs the Android SDK and the JDK set up as described in [Setup](setup.md#android-build-tools).

1. Generate the native project for the production variant. `--clean` deletes `android/` first, so local changes there are lost, which is expected since it is generated:

       APP_VARIANT=production pnpm expo prebuild --platform android --clean

2. Build the release APK. Gradle downloads its dependencies, and the NDK and CMake versions it needs into the SDK, the first time. The release build is signed with the template's debug key: the APK installs on a test device, but is not for the stores.

       (cd android && ./gradlew assembleRelease)

3. Run the check on it. It prints every permission the build requests, then fails on Firebase or Google Play services code, a blocked permission, an unexpected one, a URL scheme, a build without the content filter's VPN service and its two permissions, or a build Google Play refuses:

       scripts/check-android-release.sh android/app/build/outputs/apk/release/app-release.apk

   To see the permissions with their attributes, such as `maxSdkVersion`, `aapt2` lists them directly:

       "$ANDROID_HOME"/build-tools/<version>/aapt2 dump permissions android/app/build/outputs/apk/release/app-release.apk

4. After a dependency change, regenerate the notices of the Licenses screen from this APK and commit `src/features/settings/third-party-licenses.json`. The script fails and says why when a dependency has no license text or a license not allowed, when a native library of the APK is not in `licenses/native.json`, or when an override is no longer used. `--check` compares instead of writing:

       scripts/update-licenses.sh

5. Optionally install it with `adb install -r`, next to the development build, which has its own identifier. It runs from its bundled JavaScript only: its `INTERNET` permission serves the content filter, and nothing loads JavaScript from Metro in a release build.

6. Go back to the development variant before working with Metro again:

       APP_VARIANT=development pnpm expo prebuild --platform android --clean

The prebuild rewrites the `android` and `ios` scripts of `package.json`. `scripts/build-android-bundle.sh` puts the file back. After a prebuild by hand, restore it with `git checkout package.json`.

## Local iOS build

On a Mac with Xcode and CocoaPods, the same build as the `ios-build` job:

    APP_VARIANT=production pnpm expo prebuild --platform ios --clean --no-install
    (cd ios && pod install)
    (cd ios && xcodebuild build -workspace flust.xcworkspace -scheme flust -configuration Release \
      -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath build CODE_SIGNING_ALLOWED=NO)
    scripts/check-ios-release.sh ios/build/Build/Products/Release-iphonesimulator/flust.app

The script exits with 1 when the app registers a URL scheme, and with 2 when it cannot read the build.
