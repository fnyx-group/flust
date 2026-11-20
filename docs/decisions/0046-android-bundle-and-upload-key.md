# 0046 Android App Bundle and upload key

## Context

Google Play takes new apps as Android App Bundles only, and signs the APKs it generates from them with an app signing key it holds (Play App Signing). The developer signs each bundle with an upload key, which Play checks before accepting it. Until now the release check ran on a release APK in CI, and [Release](../development/release.md) expected the bundle from EAS, which would have kept the upload key on Expo's servers.

Play also refuses a bundle that is signed with a debug key, that is debuggable, or that targets an API level below its current requirement: API 36 for new apps and updates since 31 August 2026. Since 1 November 2025, new apps and updates that target Android 15 or later must support 16 KB memory pages on 64-bit devices ([Android Developers Blog](https://android-developers.googleblog.com/2025/05/prepare-play-apps-for-devices-with-16kb-page-size.html), [Support 16 KB page sizes](https://developer.android.com/16kb-page-size)): their `arm64-v8a` and `x86_64` libraries must be aligned for them. The `versionCode` must grow with every upload, up to 2,100,000,000.

Play reads crash reports with the R8 mapping and the native symbol tables, which Gradle writes in `android/`. The next prebuild deletes that folder. Field tests need an APK made from the exact bundle that goes to Play.

## Decision

- The Play bundle is built locally from the production prebuild by `scripts/build-android-bundle.sh --upload`, not on EAS. The upload key and its passwords never leave the maintainer's machine and never enter the repository. The iPhone build is not affected.
- Play App Signing, with an app signing key that Google generates. The upload key is an RSA key of 4,096 bits, which is more than Play's minimum of 2,048, made with `keytool` as [Release](../development/release.md#upload-key) describes. It is kept outside the repository, with a backup.
- `plugins/with-android-upload-signing.ts`, in the production variant only, appends a block to the generated `app/build.gradle` that applies `plugins/android-upload-signing.gradle`. That script signs the release build type with the upload key only when `flustRequireUploadKey` is `true`, and then fails unless the four `flustUpload*` Gradle properties are set. Every other build is signed with the template's debug key, whatever else is set, so that a key left in a Gradle property never signs a local build. `plugins/jvm-test` runs the script with plain Gradle in CI. The block also asks for the symbol tables of the native libraries (`debugSymbolLevel 'SYMBOL_TABLE'`).
- `scripts/build-android-bundle.sh --upload` alone passes `flustRequireUploadKey`. It reads the keystore path from `FLUST_UPLOAD_KEYSTORE`, which must be outside the repository, asks for the passwords, and gives the four properties to its one Gradle run through that run's environment, with `--no-daemon`. The passwords are never written to a file or put on a command line.
- The release check prints the signer of a bundle and matches it by its SHA-256. Without `--upload`, it fails on any signer but the template's debug key. With `--upload`, it fails on the debug key, and on any signer other than the upload certificate whose SHA-256 is written in the script, which stays a marked placeholder until the key exists, with an RSA key of 2,048 bits or more. It also fails on a bundle with more than one signer.
- So that an upload bundle matches its commit, `scripts/build-android-bundle.sh --upload` refuses, before the prebuild, a working tree with changes and any `.env*` file, which Git ignores and Expo loads into the build. It runs `pnpm install --frozen-lockfile --offline`, so that `node_modules` follows `pnpm-lock.yaml`, and refuses a tree the install changed.
- When the build or the check fails, the script deletes the upload-signed bundle in `android/` and every `.partial` folder of the release folder.
- The `versionCode` is set by hand in `app.json` (`expo.android.versionCode`) for each release. The check fails when the build's `versionCode` or `versionName` differs from `app.json`.
- The check also fails, on APKs and bundles alike, on another package than `org.fnyxgroup.flust`, a debuggable build, or a target API level below 36. For native libraries:
  - It fails on any `arm64-v8a` or `x86_64` library with a `LOAD` segment aligned on less than 16 KB (`llvm-readelf` from the NDK), and lists the `armeabi-v7a` and `x86` ones without failing.
  - It fails on an APK that `zipalign -c -P 16` rejects, with the zipalign of build-tools 35 or later from the SDK. A zipalign that fails without naming an entry stops the check as unable to check, not as a failed build.
  - On a bundle, it fails unless its configuration stores native libraries uncompressed with the `PAGE_ALIGNMENT_16K` alignment, unless it holds libraries for `armeabi-v7a`, `arm64-v8a`, `x86` and `x86_64`, or without the R8 mapping and native symbols in `BUNDLE-METADATA`. The build script passes the four ABIs to Gradle itself.
- For a bundle, the check builds its universal APK with bundletool, runs every APK check on it, and checks the Licenses screen against it.
- 32-bit libraries are not held to 16 KB. Devices with 16 KB pages are 64-bit only and never load them, Play checks the 64-bit ones, and the 32-bit prebuilt libraries of React Native, Hermes and the NDK are aligned on 4 KB.
- NDK 27.1, which React Native 0.88 sets, is kept. The React Native and Expo builds pass `ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES`, and the prebuilt 64-bit libraries are already aligned, so every 64-bit library of the bundle is aligned on 16 KB.
- The build script copies the bundle, the R8 mapping, the native symbols, the source map and their SHA-256 into a new folder for each build in `$FLUST_RELEASE_DIR`, `~/flust-releases` by default, outside the repository. With `--field-apk`, it adds the universal APK of the checked bundle, signed with the template's debug key.
- In CI, the `android-release` job builds the bundle next to the APK, both for the four ABIs and signed with the debug key, and checks both. bundletool's version and SHA-256 are kept in `scripts/bundletool.sh`, which the workflow downloads it with, and the two scripts check `$BUNDLETOOL` against on every run.

## Consequences

- The upload key exists only on the maintainer's machine and in its backup. If it is lost or leaked, Play can register a new upload key on request. The app signing key, held by Google, does not change.
- The Play build and the field or local APKs have different signers. Going from one to the other needs an uninstall, which deletes the local data.
- `--upload` fails until the upload certificate's SHA-256 is written in `scripts/check-android-release.sh`.
- The target API level of the check follows Play's yearly requirement and must be raised with it. A dependency that ships an unaligned 64-bit library fails the check before the release.
- Forgetting to raise `versionCode` is caught by Play, not by the check. The check only makes sure the build carries the number written in `app.json`.
- CI builds the native code of four ABIs instead of one, which about doubles the `android-release` job.
- An upload build needs the pnpm store to hold every package of the lockfile, since the install runs offline.
