#!/usr/bin/env bash
# Runs the Maestro flows in e2e/maestro against a local production release APK on an Android
# emulator (docs/decisions/0031-end-to-end-tests.md). The APK is checked first with
# scripts/check-android-release.sh, so the flows always run on what would ship.
# Maestro's analytics, update check and test analysis notice are turned off. The emulator gets a
# screen lock PIN for the lock flow, removed again at the end, along with any font scale change.
# Usage: scripts/e2e-android.sh [--apk <app-release.apk>] [--font-scale <scale>] [flow.yaml ...]
set -euo pipefail

# Read by Maestro 2.12.1: any value turns analytics off, "true" turns the others off.
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_DISABLE_UPDATE_CHECK=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

root=$(cd "$(dirname "$0")/.." && pwd)
apk=$root/android/app/build/outputs/apk/release/app-release.apk
font_scale=
pin=${E2E_PIN:-1357}
flows=()

fail() {
  echo "$1" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --apk)
      [[ $# -ge 2 ]] || fail "--apk needs a path."
      apk=$2
      shift 2
      ;;
    --font-scale)
      [[ $# -ge 2 && $2 =~ ^[0-9]+(\.[0-9]+)?$ ]] || fail "--font-scale needs a number, such as 2.0."
      font_scale=$2
      shift 2
      ;;
    -*)
      fail "Unknown option: $1"
      ;;
    *)
      flows+=("$1")
      shift
      ;;
  esac
done
[[ ${#flows[@]} -gt 0 ]] || flows=("$root/e2e/maestro")

command -v maestro >/dev/null || fail "maestro not found: see docs/development/setup.md#end-to-end-tests."
if command -v adb >/dev/null; then
  adb=$(command -v adb)
elif [[ -n ${ANDROID_HOME:-} && -x $ANDROID_HOME/platform-tools/adb ]]; then
  adb=$ANDROID_HOME/platform-tools/adb
else
  fail "adb not found: set ANDROID_HOME to the Android SDK."
fi
[[ -f $apk ]] || fail "No APK at $apk: build it as described in docs/development/release.md#local-production-build."

# Only an emulator: the script sets a screen lock PIN, which must never happen on a real phone.
mapfile -t devices < <("$adb" devices | awk 'NR > 1 && $2 == "device" { print $1 }')
[[ ${#devices[@]} -eq 1 ]] || fail "Start exactly one emulator; found ${#devices[@]} devices."
[[ ${devices[0]} == emulator-* ]] || fail "${devices[0]} is not an emulator."
export ANDROID_SERIAL=${devices[0]}

"$root/scripts/check-android-release.sh" "$apk"

previous_scale=$("$adb" shell settings get system font_scale | tr -d '\r')
pin_set=false

restore() {
  if $pin_set; then
    "$adb" shell locksettings clear --old "$pin" >/dev/null || echo "Could not remove the emulator PIN $pin." >&2
  fi
  if [[ -n $font_scale ]]; then
    if [[ $previous_scale == null ]]; then
      "$adb" shell settings delete system font_scale >/dev/null
    else
      "$adb" shell settings put system font_scale "$previous_scale"
    fi
  fi
}
trap restore EXIT

# A screen lock already set is kept when E2E_PIN is its PIN, and is not removed at the end.
if "$adb" shell locksettings set-pin "$pin" >/dev/null; then
  pin_set=true
elif ! "$adb" shell locksettings verify --old "$pin" >/dev/null; then
  fail "The emulator already has a screen lock: set E2E_PIN to its PIN, or remove it."
fi
[[ -z $font_scale ]] || "$adb" shell settings put system font_scale "$font_scale"

"$adb" install -r "$apk"
maestro test --env "PIN=$pin" "${flows[@]}"
