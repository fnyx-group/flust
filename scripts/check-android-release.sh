#!/usr/bin/env bash
# Fails when an Android build contains Firebase, Google Play services or Play Install Referrer
# code, or their manifest entries (docs/decisions/0021-local-notifications.md), or when its merged
# manifest requests a permission that is blocked in production or not expected
# (docs/decisions/0030-production-android-permissions.md), or when a component has an intent filter
# that opens a URL scheme (docs/decisions/0035-no-url-scheme-in-production.md). Lists the merged
# permissions.
# An APK is read with aapt2, from $AAPT2, the PATH or $ANDROID_HOME/build-tools. A bundle is read
# with the bundletool jar at $BUNDLETOOL, run by the Java of $JAVA_HOME or the PATH.
# Exits with 1 when the build contains something flust must not ship, 2 when it cannot be checked.
# Usage: scripts/check-android-release.sh <app.apk|app.aab>
set -euo pipefail

# Must match PRODUCTION_BLOCKED_PERMISSIONS in app.config.ts, which app.config.test.ts checks.
blocked_permissions=(
  android.permission.INTERNET
  android.permission.SYSTEM_ALERT_WINDOW
  android.permission.WRITE_EXTERNAL_STORAGE
  android.permission.ACCESS_NETWORK_STATE
  android.permission.CHANGE_WIFI_MULTICAST_STATE
  android.permission.ACCESS_LOCAL_NETWORK
)

# Must match PRODUCTION_ANDROID_PERMISSIONS in app.config.ts, which app.config.test.ts checks.
expected_permissions=(
  android.permission.POST_NOTIFICATIONS
  android.permission.RECEIVE_BOOT_COMPLETED
  android.permission.USE_BIOMETRIC
  android.permission.VIBRATE
  org.fnyxgroup.flust.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
)

cannot_check() {
  echo "$1" >&2
  exit 2
}

if [[ $# -ne 1 || ! -f $1 ]]; then
  cannot_check "Usage: $0 <app.apk|app.aab>"
fi
build=$1

case $build in
  *.apk)
    dex_pattern='^classes[0-9]*\.dex$'
    manifest='AndroidManifest.xml'
    ;;
  *.aab)
    dex_pattern='^[^/]+/dex/classes[0-9]*\.dex$'
    manifest='base/manifest/AndroidManifest.xml'
    ;;
  *)
    cannot_check "Expected an .apk or an .aab: $build"
    ;;
esac

find_aapt2() {
  if [[ -n ${AAPT2:-} ]]; then
    echo "$AAPT2"
  elif command -v aapt2 >/dev/null; then
    command -v aapt2
  else
    local sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
    [[ -n $sdk ]] && compgen -G "$sdk/build-tools/*/aapt2" | sort -V | tail -n 1
  fi
}

find_java() {
  if [[ -n ${JAVA_HOME:-} ]]; then
    echo "$JAVA_HOME/bin/java"
  else
    command -v java
  fi
}

# Looked up before the scans, so that a missing tool stops the check before it reports anything.
if [[ $build == *.apk ]]; then
  aapt2=$(find_aapt2 || true)
  [[ -n $aapt2 && -x $aapt2 ]] || cannot_check "aapt2 not found: set AAPT2, or ANDROID_HOME to the Android SDK."
else
  java=$(find_java || true)
  [[ -n $java && -x $java ]] || cannot_check "java not found: set JAVA_HOME."
  [[ -n ${BUNDLETOOL:-} && -f $BUNDLETOOL ]] || cannot_check "bundletool not found: set BUNDLETOOL to the bundletool jar."
fi

mapfile -t dex_files < <(unzip -Z1 "$build" | grep -E "$dex_pattern" || true)
if [[ ${#dex_files[@]} -eq 0 ]]; then
  cannot_check "No dex files found in $build"
fi
# Not grep -q: it stops at the first match, unzip then fails on the closed pipe, and pipefail
# would report the manifest as missing.
if ! unzip -Z1 "$build" | grep -xF "$manifest" >/dev/null; then
  cannot_check "No manifest found in $build"
fi

# grep exits with 1 when nothing matches, which is what a clean build gives. Any other failure in
# the pipeline, such as unzip on a damaged file, still fails it.
matches() {
  grep "$@" || [[ $? -eq 1 ]]
}

# Class names are plain text in dex files. The manifest is binary XML, with UTF-16 or UTF-8
# strings, or protobuf in a bundle: without the NUL bytes, its names read as text either way.
classes=$(
  for dex in "${dex_files[@]}"; do unzip -p "$build" "$dex" || exit 2; done |
    LC_ALL=C matches -a -o -E 'L(com/google/firebase|com/google/android/gms|com/android/installreferrer)/[A-Za-z0-9_/$]*' |
    sort -u
) || cannot_check "Cannot read the dex files of $build"
entries=$(
  unzip -p "$build" "$manifest" | tr -d '\000' |
    LC_ALL=C matches -a -o -E 'com\.google\.(firebase|android\.gms|android\.c2dm|android\.finsky)[A-Za-z0-9_.]*' |
    sort -u
) || cannot_check "Cannot read the manifest of $build"

# Requested permissions only: a text search would also find android:permission attributes, which
# protect a component, and miss the permissions flust defines.
requested_permissions() {
  if [[ $build == *.apk ]]; then
    "$aapt2" dump permissions "$build" | sed -nE "s/^uses-permission(-sdk-23)?: name='([^']+)'.*/\2/p"
  else
    "$java" -jar "$BUNDLETOOL" dump manifest --bundle="$build" \
      --xpath='/manifest/uses-permission/@android:name | /manifest/uses-permission-sdk-23/@android:name'
  fi
}

permissions=$(requested_permissions | sort -u) || cannot_check "Cannot read the permissions of $build"
# Every production build requests some, so an empty list means the output was not understood.
[[ -n $permissions ]] || cannot_check "No permission read from $build: check the output of the tool that reads it."
echo "Permissions in $build:"
sed 's/^/  /' <<<"$permissions"

# Schemes of the intent filters that open URLs: a VIEW action with a data scheme. The <queries>
# entry that lets flust open web links is an <intent>, not an <intent-filter>, so it is not one.
url_schemes() {
  if [[ $build == *.apk ]]; then
    "$aapt2" dump xmltree --file AndroidManifest.xml "$build" | awk '
      function flush(  i) {
        if (inside && view) for (i = 1; i <= count; i++) print schemes[i]
        inside = 0; view = 0; count = 0
      }
      { match($0, /^ */); indent = RLENGTH }
      inside && indent <= depth { flush() }
      /^ *E: intent-filter / { inside = 1; depth = indent; next }
      inside && /:name\(0x01010003\)="android\.intent\.action\.VIEW"/ { view = 1 }
      inside && /:scheme\(0x01010027\)="/ {
        scheme = $0
        sub(/.*:scheme\(0x01010027\)="/, "", scheme)
        sub(/".*/, "", scheme)
        schemes[++count] = scheme
      }
      END { flush() }
    '
  else
    "$java" -jar "$BUNDLETOOL" dump manifest --bundle="$build" \
      --xpath="//intent-filter[action/@android:name='android.intent.action.VIEW']/data/@android:scheme"
  fi
}

schemes=$(url_schemes | sort -u) || cannot_check "Cannot read the intent filters of $build"

listed() {
  local item=$1 candidate
  shift
  for candidate; do
    [[ $candidate == "$item" ]] && return 0
  done
  return 1
}

blocked_found=()
unexpected_found=()
while IFS= read -r permission; do
  if listed "$permission" "${blocked_permissions[@]}"; then
    blocked_found+=("$permission")
  elif ! listed "$permission" "${expected_permissions[@]}"; then
    unexpected_found+=("$permission")
  fi
done <<<"$permissions"

failed=0
if [[ -n $classes || -n $entries ]]; then
  echo "$build contains code or manifest entries that flust must not ship:" >&2
  [[ -n $classes ]] && sed 's/^/  class /' <<<"$classes" >&2
  [[ -n $entries ]] && sed 's/^/  manifest /' <<<"$entries" >&2
  failed=1
fi
if [[ ${#blocked_found[@]} -gt 0 ]]; then
  echo "$build requests permissions that production builds must not have:" >&2
  printf '  %s\n' "${blocked_found[@]}" >&2
  failed=1
fi
if [[ ${#unexpected_found[@]} -gt 0 ]]; then
  echo "$build requests permissions that are not expected. Block them, or add them to PRODUCTION_ANDROID_PERMISSIONS and to this script with a reason:" >&2
  printf '  %s\n' "${unexpected_found[@]}" >&2
  failed=1
fi
if [[ -n $schemes ]]; then
  echo "$build opens URL schemes, which let any web page detect or open flust:" >&2
  sed 's/^/  /' <<<"$schemes" >&2
  failed=1
fi
[[ $failed -eq 0 ]] || exit 1

echo "$build: no Firebase, Google Play services or Install Referrer code or manifest entries, only expected permissions, and no URL scheme."
