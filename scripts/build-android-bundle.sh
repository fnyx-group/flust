#!/usr/bin/env bash
# Builds the Android App Bundle for Google Play from the production prebuild, for the four ABIs,
# checks it with scripts/check-android-release.sh, and keeps it with its R8 mapping, native symbols,
# source map and their SHA-256 in a new folder of $FLUST_RELEASE_DIR, ~/flust-releases by default,
# outside the repository: the next prebuild deletes android/ and what Gradle wrote there
# (docs/decisions/0046-android-bundle-and-upload-key.md).
#
# Without --upload, the bundle is signed with the template's debug key, for local checks and field
# tests, and the check fails on any other signer.
# --upload signs it with the upload key, at the path of $FLUST_UPLOAD_KEYSTORE with the alias
# $FLUST_UPLOAD_KEY_ALIAS, flust-upload by default, whose passwords it asks for. It needs a clean
# working tree, no .env file and node_modules installed from pnpm-lock.yaml, so that the bundle
# matches its commit (docs/development/release.md#android-bundle).
# --field-apk also builds the universal APK of the checked bundle, signed with the debug key, to
# install on a phone for field tests.
#
# Gradle, the prebuild and bundletool need what scripts/check-android-release.sh needs: JAVA_HOME,
# ANDROID_HOME and BUNDLETOOL (docs/development/setup.md#android-build-tools).
# Usage: scripts/build-android-bundle.sh [--upload] [--field-apk]
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
android=$root/android
release_dir=${FLUST_RELEASE_DIR:-$HOME/flust-releases}
architectures=armeabi-v7a,arm64-v8a,x86,x86_64
upload=0
field_apk=0

fail() {
  echo "$1" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --upload) upload=1 ;;
    --field-apk) field_apk=1 ;;
    *) fail "Usage: $0 [--upload] [--field-apk]" ;;
  esac
  shift
done

if [[ -n ${JAVA_HOME:-} ]]; then
  java=$JAVA_HOME/bin/java
else
  java=$(command -v java || true)
fi
[[ -n $java && -x $java ]] || fail "java not found: set JAVA_HOME."
# CI runs shellcheck on each script alone, which does not follow it.
# shellcheck disable=SC1091
source "$root/scripts/bundletool.sh"
problem=$(bundletool_problem) || fail "$problem"
command -v zip >/dev/null || fail "zip not found: it packs the native symbols."

cd "$root"
tree_is_clean() {
  [[ -z $(git status --porcelain) ]]
}
dirty=''
if ! tree_is_clean; then
  [[ $upload -eq 0 ]] || fail "The working tree has changes: commit or stash them before an upload build."
  dirty=-dirty
fi
commit=$(git rev-parse --short=12 HEAD)

if [[ $upload -eq 1 ]]; then
  # Expo loads .env files into the build, and Git ignores them, so the commit would not say what
  # the bundle holds.
  env_files=$(compgen -G "$root/.env*" || true)
  [[ -z $env_files ]] || fail "Move these files out of the repository before an upload build, since Expo loads them into it: $(tr '\n' ' ' <<<"$env_files")"

  [[ -n ${FLUST_UPLOAD_KEYSTORE:-} && -f $FLUST_UPLOAD_KEYSTORE ]] ||
    fail "Set FLUST_UPLOAD_KEYSTORE to the upload keystore (docs/development/release.md#upload-key)."
  keystore=$(realpath "$FLUST_UPLOAD_KEYSTORE")
  [[ $keystore != "$root"/* ]] || fail "The upload keystore is in the repository: move it out, as docs/development/release.md#upload-key describes."
  key_alias=${FLUST_UPLOAD_KEY_ALIAS:-flust-upload}
  # Asked first, so that the build then runs unattended. Kept in this shell only, and given to the
  # one Gradle run below.
  read -rs -p "Password of $keystore: " store_password || fail "No keystore password read."
  echo >&2
  [[ -n $store_password ]] || fail "No keystore password read."
  read -rs -p "Password of the key $key_alias (Enter if it is the same): " key_password ||
    fail "No key password read."
  echo >&2
  key_password=${key_password:-$store_password}

  # node_modules as pnpm-lock.yaml of the commit has it, from the store only.
  pnpm install --frozen-lockfile --offline
  tree_is_clean || fail "pnpm install changed the working tree: commit the change, or find out why, before an upload build."
fi

# The prebuild rewrites the scripts of package.json, which stays as committed.
work=$(mktemp -d "${TMPDIR:-/tmp}/flust-bundle.XXXXXX")
cp package.json "$work/package.json"
partial=''
cleanup() {
  local status=$?
  cp "$work/package.json" "$root/package.json"
  rm -rf "$work"
  [[ $status -ne 0 ]] || return 0
  # A failed build leaves nothing half done: no partial archive folder, and no upload-signed bundle
  # outside the archive.
  [[ -z $partial ]] || rm -rf "$partial"
  rm -rf "$release_dir"/*.partial
  [[ $upload -eq 0 ]] || rm -rf "$android/app/build/outputs/bundle"
}
trap cleanup EXIT

APP_VARIANT=production pnpm expo prebuild --platform android --clean --no-install

# The ABIs are given here, so that a reactNativeArchitectures of ~/.gradle/gradle.properties, set to
# speed up development builds, cannot leave some out of the Play bundle.
gradle_flags=("-PreactNativeArchitectures=$architectures")
if [[ $upload -eq 1 ]]; then
  # No daemon, so that the passwords leave memory with the build. They go through the environment
  # of this run only, never on the command line, which other processes can read.
  (cd "$android" &&
    ORG_GRADLE_PROJECT_flustUploadStoreFile=$keystore \
      ORG_GRADLE_PROJECT_flustUploadStorePassword=$store_password \
      ORG_GRADLE_PROJECT_flustUploadKeyAlias=$key_alias \
      ORG_GRADLE_PROJECT_flustUploadKeyPassword=$key_password \
      ./gradlew --no-daemon bundleRelease "${gradle_flags[@]}" -PflustRequireUploadKey=true)
  unset store_password key_password
else
  (cd "$android" && ./gradlew bundleRelease "${gradle_flags[@]}")
fi

aab=$android/app/build/outputs/bundle/release/app-release.aab
check_flags=()
[[ $upload -eq 0 ]] || check_flags+=(--upload)
"$root/scripts/check-android-release.sh" "${check_flags[@]}" "$aab"

version=$(node -e '
  const app = require(process.argv[1]).expo;
  console.log(app.version + "-" + app.android.versionCode);
' "$root/app.json")
signing=debug-signed
[[ $upload -eq 0 ]] || signing=upload
name=flust-$version
# The time keeps every build of a commit, so that nothing archived is ever overwritten. The files
# are gathered in a partial folder first, so that a folder with the final name is always complete.
destination=$release_dir/$version-$commit$dirty-$(date -u +%Y%m%dT%H%M%SZ)
partial=$destination.partial
mkdir -p "$partial"

cp "$aab" "$partial/$name-$signing.aab"
cp "$android/app/build/outputs/mapping/release/mapping.txt" "$partial/$name-mapping.txt"
cp "$android/app/build/generated/sourcemaps/react/release/index.android.bundle.map" \
  "$partial/$name-index.android.bundle.map"
# Gradle writes native-debug-symbols.zip for APKs only. The bundle carries the symbol tables, one
# folder per ABI, the layout Play Console takes when it asks for them.
symbols=BUNDLE-METADATA/com.android.tools.build.debugsymbols
unzip -q "$aab" "$symbols/*" -d "$work/symbols"
(cd "$work/symbols/$symbols" && zip -q -r "$partial/$name-native-debug-symbols.zip" .)

if [[ $field_apk -eq 1 ]]; then
  # The template's debug key, the same as the local release APK's, so that one replaces the other.
  "$java" -jar "$BUNDLETOOL" build-apks --bundle="$aab" --output="$work/field.apks" --mode=universal \
    --ks="$android/app/debug.keystore" --ks-pass=pass:android \
    --ks-key-alias=androiddebugkey --key-pass=pass:android
  unzip -p "$work/field.apks" universal.apk >"$partial/$name-field.apk"
fi

(cd "$partial" && sha256sum -- * >SHA256SUMS)
mv "$partial" "$destination"
partial=''

echo
echo "Bundle, signed with the ${signing%-signed} key, and its files in $destination:"
sed 's/^/  /' "$destination/SHA256SUMS"
if [[ $field_apk -eq 1 ]]; then
  echo
  echo "Install the field APK with:"
  echo "  adb install -r '$destination/$name-field.apk'"
  echo "It has another signer than the Play build: going from one to the other needs an uninstall, which deletes the local data."
fi
