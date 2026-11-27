#!/usr/bin/env bash
# Runs the Maestro flows in e2e/maestro against a local production release APK on an Android
# emulator (docs/decisions/0031-end-to-end-tests.md). The APK is checked first with
# scripts/check-android-release.sh, so the flows always run on what would ship.
# Maestro's analytics, update check and test analysis notice are turned off. The emulator gets a
# screen lock PIN for the lock flow, removed again at the end, along with any font scale change.
# The app's log is recorded during the run, and its path printed when a flow fails or the run is
# interrupted.
# A full run ends with the recreation check of e2e/maestro/recreate: a font size change while the
# app is open, which makes Android recreate the activity (docs/decisions/0048-router-per-root.md).
# Usage: scripts/e2e-android.sh [--apk <app-release.apk>] [--font-scale <scale>] [flow.yaml ...]
set -euo pipefail

# Read by Maestro 2.12.1: any value turns analytics off, "true" turns the others off.
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_DISABLE_UPDATE_CHECK=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

root=$(cd "$(dirname "$0")/.." && pwd)
package=org.fnyxgroup.flust
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
recreate=false
if [[ ${#flows[@]} -eq 0 ]]; then
  flows=("$root/e2e/maestro")
  recreate=true
fi
# The PIN reaches the device shell through adb, so only digits are accepted.
[[ $pin =~ ^[0-9]{4,16}$ ]] || fail "E2E_PIN must be 4 to 16 digits."

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
qemu=$("$adb" shell 'getprop ro.boot.qemu; getprop ro.kernel.qemu' | tr -d '\r')
[[ $qemu == *1* ]] || fail "$ANDROID_SERIAL does not report itself as an emulator."

"$root/scripts/check-android-release.sh" "$apk"

previous_scale=$("$adb" shell settings get system font_scale | tr -d '\r')
pin_set=false
logcat_pid=
logcat_file=
status=1

# shellcheck disable=SC2329 # Called by trap restore EXIT, which shellcheck does not follow.
restore() {
  if [[ -n $logcat_pid ]]; then
    kill "$logcat_pid" 2>/dev/null || true
    if [[ $status -eq 0 ]]; then
      rm -f "$logcat_file"
    else
      echo "App log of this run: $logcat_file" >&2
    fi
  fi
  if $pin_set; then
    "$adb" shell locksettings clear --old "$pin" >/dev/null || echo "Could not remove the emulator PIN $pin." >&2
  fi
  if [[ -n $font_scale ]] || $recreate; then
    if [[ $previous_scale == null ]]; then
      "$adb" shell settings delete system font_scale >/dev/null ||
        echo "Could not reset the emulator font scale." >&2
    else
      "$adb" shell settings put system font_scale "$previous_scale" ||
        echo "Could not restore the emulator font scale $previous_scale." >&2
    fi
  fi
}
trap restore EXIT

# A screen lock already set is kept when E2E_PIN is its PIN, and is not removed at the end.
# pin_set is true before set-pin, so an interruption right after it still removes the PIN; a
# removal with a PIN that was never set only fails.
pin_set=true
if ! "$adb" shell locksettings set-pin "$pin" >/dev/null; then
  pin_set=false
  "$adb" shell locksettings verify --old "$pin" >/dev/null ||
    fail "The emulator already has a screen lock: set E2E_PIN to its PIN, or remove it."
fi
[[ -z $font_scale ]] || "$adb" shell settings put system font_scale "$font_scale"

# With a PIN set, a sleeping screen shows the keyguard, which the flows cannot pass.
"$adb" shell input keyevent KEYCODE_WAKEUP

"$adb" install -r "$apk"

# Each launch of the app is a new process: the system's lines naming the package give each new
# PID (and show a process that died or restarted), and the app's own lines are kept by PID.
logcat_file=$(mktemp "${TMPDIR:-/tmp}/flust-e2e-logcat.XXXXXX")
"$adb" logcat -c
"$adb" logcat -v threadtime > >(
  awk -v package="$package" '
    index($0, package) {
      if (match($0, /Start proc [0-9]+:/)) pids[substr($0, RSTART + 11, RLENGTH - 12)] = 1
      print
      fflush()
      next
    }
    $3 in pids {
      print
      fflush()
    }
  ' > "$logcat_file"
) &
logcat_pid=$!

# Maestro does not read ANDROID_SERIAL. status stays 1 until Maestro returns, so an interrupted
# run keeps its log.
run_maestro() {
  maestro --device "$ANDROID_SERIAL" test --env "PIN=$pin" "$@"
}

# Any other font size recreates the activity, while the app shows Home.
recreate_check() {
  local scale=${font_scale:-$previous_scale}
  local other=1.3
  [[ $scale != "$other" ]] || other=1.0
  run_maestro "$root/e2e/maestro/recreate/before.yaml" &&
    "$adb" shell settings put system font_scale "$other" &&
    sleep 3 &&
    run_maestro "$root/e2e/maestro/recreate/after.yaml"
}

if run_maestro "${flows[@]}" && { ! $recreate || recreate_check; }; then
  status=0
else
  status=$?
fi
exit "$status"
