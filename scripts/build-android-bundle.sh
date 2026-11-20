#!/usr/bin/env bash
# Builds the Android App Bundle for Google Play from the production prebuild, every ABI, checks it
# with scripts/check-android-release.sh, and keeps it with its R8 mapping, native symbols, source
# map and their SHA-256 in a new folder of $FLUST_RELEASE_DIR, ~/flust-releases by default, outside
# the repository: the next prebuild deletes android/ and what Gradle wrote there
# (docs/decisions/0046-android-bundle-and-upload-key.md).
#
# Without --upload, the bundle is signed with the debug key, for local checks and field tests.
# --upload signs it with the upload key set up as docs/development/release.md#upload-key
# describes, fails without it, and needs a clean working tree so the bundle matches its commit.
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
[[ -n ${BUNDLETOOL:-} && -f $BUNDLETOOL ]] || fail "bundletool not found: set BUNDLETOOL to the bundletool jar."
command -v zip >/dev/null || fail "zip not found: it packs the native symbols."

cd "$root"
dirty=''
if [[ -n $(git status --porcelain) ]]; then
  [[ $upload -eq 0 ]] || fail "The working tree has changes: commit or stash them before an upload build."
  dirty=-dirty
fi
commit=$(git rev-parse --short=12 HEAD)

# The prebuild rewrites the scripts of package.json, which stays as committed.
work=$(mktemp -d "${TMPDIR:-/tmp}/flust-bundle.XXXXXX")
cp package.json "$work/package.json"
trap 'cp "$work/package.json" package.json; rm -rf "$work"' EXIT

APP_VARIANT=production pnpm expo prebuild --platform android --clean --no-install

gradle_flags=()
[[ $upload -eq 0 ]] || gradle_flags+=(-PflustRequireUploadKey=true)
(cd "$android" && ./gradlew bundleRelease "${gradle_flags[@]}")

aab=$android/app/build/outputs/bundle/release/app-release.aab
check_flags=()
[[ $upload -eq 0 ]] || check_flags+=(--upload)
"$root/scripts/check-android-release.sh" "${check_flags[@]}" "$aab"

version=$(node -e '
  const app = require(process.argv[1]).expo;
  console.log(`${app.version}-${app.android.versionCode}`);
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

echo
echo "Bundle, signed with the ${signing%-signed} key, and its files in $destination:"
sed 's/^/  /' "$destination/SHA256SUMS"
if [[ $field_apk -eq 1 ]]; then
  echo
  echo "Install the field APK with:"
  echo "  adb install -r '$destination/$name-field.apk'"
  echo "It has another signer than the Play build: going from one to the other needs an uninstall, which deletes the local data."
fi
