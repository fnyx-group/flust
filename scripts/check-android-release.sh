#!/usr/bin/env bash
# Fails when an Android build contains Firebase, Google Play services or Play Install Referrer
# code, or their manifest entries (docs/decisions/0021-local-notifications.md), or when its merged
# manifest still requests a permission blocked in production
# (docs/decisions/0030-production-android-permissions.md). Lists the merged permissions.
# An APK is read with aapt2, from $AAPT2, the PATH or $ANDROID_HOME/build-tools.
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

if [[ $# -ne 1 || ! -f $1 ]]; then
  echo "Usage: $0 <app.apk|app.aab>" >&2
  exit 2
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
    echo "Expected an .apk or an .aab: $build" >&2
    exit 2
    ;;
esac

mapfile -t dex_files < <(unzip -Z1 "$build" | grep -E "$dex_pattern" || true)
if [[ ${#dex_files[@]} -eq 0 ]]; then
  echo "No dex files found in $build" >&2
  exit 2
fi
# Not grep -q: it stops at the first match, unzip then fails on the closed pipe, and pipefail
# would report the manifest as missing.
if ! unzip -Z1 "$build" | grep -xF "$manifest" >/dev/null; then
  echo "No manifest found in $build" >&2
  exit 2
fi

# Class names are plain text in dex files. The manifest is binary XML, with UTF-16 or UTF-8
# strings, or protobuf in a bundle: without the NUL bytes, its names read as text either way.
classes=$(
  for dex in "${dex_files[@]}"; do unzip -p "$build" "$dex"; done |
    LC_ALL=C grep -a -o -E 'L(com/google/firebase|com/google/android/gms|com/android/installreferrer)/[A-Za-z0-9_/$]*' |
    sort -u || true
)
entries=$(
  unzip -p "$build" "$manifest" | tr -d '\000' |
    LC_ALL=C grep -a -o -E 'com\.google\.(firebase|android\.gms|android\.c2dm|android\.finsky)[A-Za-z0-9_.]*' |
    sort -u || true
)

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

# An APK's manifest is binary XML, whose string pool cannot be searched as text reliably: aapt2
# reads it. A bundle's manifest is protobuf, where a name is followed by a field tag that is never
# a capital letter or an underscore, so a text search finds each name whole.
merged_permissions() {
  if [[ $build == *.apk ]]; then
    local aapt2
    aapt2=$(find_aapt2 || true)
    if [[ -z $aapt2 || ! -x $aapt2 ]]; then
      echo "aapt2 not found: set AAPT2, or ANDROID_HOME to the Android SDK." >&2
      exit 2
    fi
    "$aapt2" dump permissions "$build" | sed -nE "s/^uses-permission(-sdk-23)?: name='([^']+)'.*/\2/p"
  else
    unzip -p "$build" "$manifest" | LC_ALL=C grep -a -o -E 'android\.permission\.[A-Z_]+' || true
  fi | sort -u
}

permissions=$(merged_permissions)
echo "Permissions in $build:"
sed 's/^/  /' <<<"$permissions"

blocked_found=$(
  for permission in "${blocked_permissions[@]}"; do
    grep -qxF "$permission" <<<"$permissions" && echo "$permission"
  done || true
)

failed=0
if [[ -n $classes || -n $entries ]]; then
  echo "$build contains code or manifest entries that flust must not ship:" >&2
  [[ -n $classes ]] && sed 's/^/  class /' <<<"$classes" >&2
  [[ -n $entries ]] && sed 's/^/  manifest /' <<<"$entries" >&2
  failed=1
fi
if [[ -n $blocked_found ]]; then
  echo "$build requests permissions that production builds must not have:" >&2
  sed 's/^/  /' <<<"$blocked_found" >&2
  failed=1
fi
[[ $failed -eq 0 ]] || exit 1

echo "$build: no Firebase, Google Play services or Install Referrer code or manifest entries, and no blocked permission."
