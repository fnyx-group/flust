#!/usr/bin/env bash
# Fails when an Android build contains Firebase, Google Play services or Play Install Referrer
# code, or their manifest entries (docs/decisions/0021-local-notifications.md).
# Usage: scripts/check-android-release.sh <app.apk|app.aab>
set -euo pipefail

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
if ! unzip -Z1 "$build" | grep -qxF "$manifest"; then
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

if [[ -n $classes || -n $entries ]]; then
  echo "$build contains code or manifest entries that flust must not ship:" >&2
  [[ -n $classes ]] && sed 's/^/  class /' <<<"$classes" >&2
  [[ -n $entries ]] && sed 's/^/  manifest /' <<<"$entries" >&2
  exit 1
fi

echo "$build: no Firebase, Google Play services or Install Referrer code or manifest entries."
