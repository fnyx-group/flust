# 0046 Android App Bundle and upload key

## Context

Google Play takes new apps as Android App Bundles only, and signs the APKs it generates from them with an app signing key it holds (Play App Signing). The developer signs each bundle with an upload key, which Play checks before accepting it. Until now the release check ran on a release APK in CI, and [Release](../development/release.md) expected the bundle from EAS, which would have kept the upload key on Expo's servers.

Play also refuses a bundle that is signed with a debug key, that is debuggable, or that targets an API level below its current requirement: API 36 for new apps and updates since 31 August 2026. From 1 February 2027 it refuses updates whose 64-bit native libraries cannot run with 16 KB memory pages. The `versionCode` must grow with every upload, up to 2,100,000,000.

Play reads crash reports with the R8 mapping and the native symbol tables, which Gradle writes in `android/`. The next prebuild deletes that folder. Field tests need an APK made from the exact bundle that goes to Play.

## Decision

- The Play bundle is built locally from the production prebuild by `scripts/build-android-bundle.sh --upload`, not on EAS. The upload key and its passwords never leave the maintainer's machine and never enter the repository. The iPhone build is not affected.
- Play App Signing, with an app signing key that Google generates. The upload key is an RSA key of 4,096 bits, which is more than Play's minimum of 2,048, made with `keytool` as [Release](../development/release.md#upload-key) describes. It is kept outside the repository, with a backup.
- `plugins/with-android-upload-signing.ts`, in the production variant only, appends a block to the generated `app/build.gradle`. It signs the release build type with the upload key when the four `flustUpload*` Gradle properties are set, from `~/.gradle/gradle.properties` or `ORG_GRADLE_PROJECT_*` variables. If none is set, it signs with the template's debug key. It fails the build when only some are set, or when `flustRequireUploadKey` is set and the key is not. It also asks for the symbol tables of the native libraries (`debugSymbolLevel 'SYMBOL_TABLE'`).
- The release check prints the signer of a bundle. With `--upload`, it fails on the debug key by name, and on any signer other than the upload certificate whose SHA-256 is written in the script, which stays a marked placeholder until the key exists, with an RSA key of 2,048 bits or more.
- `scripts/build-android-bundle.sh --upload` refuses a working tree with changes, before the prebuild, so that an upload bundle always matches its commit.
- The `versionCode` is set by hand in `app.json` (`expo.android.versionCode`) for each release. The check fails when the build's `versionCode` or `versionName` differs from `app.json`.
- The check also fails, on APKs and bundles alike, on another package than `org.fnyxgroup.flust`, a debuggable build, or a target API level below 36. For native libraries:
  - It fails on any `arm64-v8a` or `x86_64` library with a `LOAD` segment aligned on less than 16 KB (`llvm-readelf` from the NDK).
  - It fails on an APK that `zipalign -c -P 16` rejects.
  - On a bundle, it fails without `PAGE_ALIGNMENT_16K` in the bundle configuration, or without the R8 mapping and native symbols in `BUNDLE-METADATA`.
- For a bundle, the check builds its universal APK with bundletool, runs every APK check on it, and checks the Licenses screen against it.
- 32-bit libraries are not held to 16 KB. Devices with 16 KB pages are 64-bit only and never load them, Play checks the 64-bit ones, and the 32-bit prebuilt libraries of React Native, Hermes and the NDK are aligned on 4 KB.
- NDK 27.1, which React Native 0.88 sets, is kept. The React Native and Expo builds pass `ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES`, and the prebuilt 64-bit libraries are already aligned, so every 64-bit library of the bundle is aligned on 16 KB.
- The build script copies the bundle, the R8 mapping, the native symbols, the source map and their SHA-256 into a new folder for each build in `$FLUST_RELEASE_DIR`, `~/flust-releases` by default, outside the repository. With `--field-apk`, it adds the universal APK of the checked bundle, signed with the template's debug key.
- In CI, the `android-release` job builds the bundle next to the APK, signed with the debug key, and checks both. bundletool's version and SHA-256 are pinned in the workflow.

## Consequences

- The upload key exists only on the maintainer's machine and in its backup. If it is lost or leaked, Play can register a new upload key on request. The app signing key, held by Google, does not change.
- The Play build and the field or local APKs have different signers. Going from one to the other needs an uninstall, which deletes the local data.
- `--upload` fails until the upload certificate's SHA-256 is written in `scripts/check-android-release.sh`.
- The target API level of the check follows Play's yearly requirement and must be raised with it. A dependency that ships an unaligned 64-bit library fails the check before the release.
- Forgetting to raise `versionCode` is caught by Play, not by the check. The check only makes sure the build carries the number written in `app.json`.
- CI checks the 16 KB alignment of `arm64-v8a` only. `x86_64` is checked on the local bundle of each release.
