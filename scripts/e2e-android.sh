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
# It then runs the layout flows of e2e/maestro/layout at font scale 1.0 and the default display
# size, and at 2.0 and the largest display size, and checks a dump of each screen with
# scripts/check-layout.ts (docs/decisions/0050-layout-matrix.md). --layout runs only them, at the
# font scale and density given or the emulator's own. --matrix runs them at the corners of the
# font scales and display sizes Android offers, then checks that home fits without scrolling
# 667 points tall. --full-matrix runs them at every combination, a check of several hours before
# a release.
# The dumps are kept in a folder whose path is printed at the end.
# Usage: scripts/e2e-android.sh [--apk <app-release.apk>] [--font-scale <scale>] [--density <dpi>]
#   [--layout | --matrix | --full-matrix | flow.yaml ...]
set -euo pipefail

# Read by Maestro 2.12.1: any value turns analytics off, "true" turns the others off.
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_DISABLE_UPDATE_CHECK=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

root=$(cd "$(dirname "$0")/.." && pwd)
package=org.fnyxgroup.flust
apk=$root/android/app/build/outputs/apk/release/app-release.apk
font_scale=
density=
layout=false
matrix=false
full_matrix=false
pin=${E2E_PIN:-1357}
flows=()
# The font sizes of Android 14 and later, from Settings, Display, Display size and text.
font_scales=(0.85 1.0 1.15 1.3 1.5 1.8 2.0)

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
    --density)
      [[ $# -ge 2 && $2 =~ ^[0-9]+$ ]] || fail "--density needs a whole number of dpi, such as 540."
      density=$2
      shift 2
      ;;
    --layout)
      layout=true
      shift
      ;;
    --matrix)
      matrix=true
      shift
      ;;
    --full-matrix)
      matrix=true
      full_matrix=true
      shift
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
! $layout || ! $matrix || fail "--layout and a matrix do not go together."
if { $layout || $matrix; } && [[ ${#flows[@]} -gt 0 ]]; then
  fail "--layout and the matrices run the layout flows only, without other flows."
fi
! $matrix || [[ -z $font_scale && -z $density ]] || fail "A matrix sets the font scale and density itself."
recreate=false
if [[ ${#flows[@]} -eq 0 ]] && ! $layout && ! $matrix; then
  flows=("$root/e2e/maestro")
  recreate=true
fi
# The PIN reaches the device shell through adb, so only digits are accepted.
[[ $pin =~ ^[0-9]{4,16}$ ]] || fail "E2E_PIN must be 4 to 16 digits."

command -v node >/dev/null || fail "node not found: see docs/development/setup.md."
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
display_changed=false
layout_dir=
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
  if $display_changed; then
    "$adb" shell wm density reset >/dev/null || echo "Could not reset the emulator density." >&2
    "$adb" shell wm size reset >/dev/null || echo "Could not reset the emulator screen size." >&2
  fi
  [[ -z $layout_dir ]] || echo "Layout dumps of this run: $layout_dir" >&2
  if [[ -n $font_scale ]] || $recreate || $layout || $matrix; then
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
if [[ -n $density ]]; then
  display_changed=true
  "$adb" shell wm density "$density" >/dev/null
fi

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

# The densities of Settings, Display size, as Android derives them from the default density and
# the shorter side of the screen (DisplayDensityUtils): one step smaller, and up to three larger,
# up to 1.5 times the default and a width of 320 dp, each rounded down to an even number.
display_densities() {
  local size default
  size=$("$adb" shell wm size | awk -F'[ x]' '/Physical size/ { print ($3 < $4 ? $3 : $4) }')
  default=$("$adb" shell wm density | awk '/Physical density/ { print $3 }')
  awk -v default="$default" -v short="$size" 'BEGIN {
    max = 160 * short / 320 / default
    if (max > 1.5) max = 1.5
    larger = int((max - 1) / 0.09)
    if (larger > 3) larger = 3
    if (larger < 0) larger = 0
    printf "%d", int(default * 0.85) - int(default * 0.85) % 2
    printf " %d", default
    for (i = 1; i <= larger; i++) {
      value = int(default * (1 + i * (max - 1) / larger))
      printf " %d", value - value % 2
    }
    print ""
  }'
}

# The pixel rows of the status bar's bottom and the navigation bar's top, for the checker.
bar_edges() {
  "$adb" shell dumpsys window | awk '
    !status && /type=statusBars frame=/ { match($0, /frame=\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]/); split(substr($0, RSTART, RLENGTH), f, /[^0-9]+/); status = f[5] }
    !nav && /type=navigationBars frame=/ { match($0, /frame=\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]/); split(substr($0, RSTART, RLENGTH), f, /[^0-9]+/); nav = f[3] }
    END { print status, nav }
  '
}

# Through Maestro's driver: uiautomator dump waits for the screen to be idle, which the breathing
# guide of the emergency screen never is.
dump_screen() {
  maestro --device "$ANDROID_SERIAL" hierarchy >"$1" 2>/dev/null
}

check_layout() {
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$root/scripts/check-layout.ts" "$@"
}

# Runs the layout flows in order at a font scale, a density and an optional screen size, and
# checks a dump of each screen. At font scale 1.0 or below and a default display, home must also
# fit without scrolling: a swipe on it must not move anything.
# Usage: layout_pass <font scale> <density> [<width>x<height>] [<last flow>]
layout_pass() {
  local scale=$1 dpi=$2 size=${3:-} last=${4:-} name flow file width status_bottom nav_top fits
  local physical failed=0 checked=0
  physical=$("$adb" shell wm density | awk '/Physical density/ { print $3 }')
  display_changed=true
  "$adb" shell settings put system font_scale "$scale"
  if [[ -n $size ]]; then "$adb" shell wm size "$size"; else "$adb" shell wm size reset; fi
  "$adb" shell wm density "$dpi" >/dev/null
  sleep 2
  read -r status_bottom nav_top < <(bar_edges)
  width=$("$adb" shell wm size | awk -F'[ x]' '/Override size/ { o = $3 } /Physical size/ { p = $3 } END { print o ? o : p }')
  fits=false
  awk -v s="$scale" 'BEGIN { exit !(s <= 1.0) }' && [[ -n $size || $dpi -le $physical ]] && fits=true
  echo "Layout at font scale $scale, $dpi dpi${size:+, $size}"
  for flow in "$root"/e2e/maestro/layout/*.yaml; do
    name=$(basename "$flow" .yaml)
    if ! run_maestro "$flow" >"$layout_dir/$scale-$dpi${size:+-$size}-$name.log" 2>&1; then
      echo "  $name: the flow failed after $checked screens, see $layout_dir/$scale-$dpi${size:+-$size}-$name.log" >&2
      return 1
    fi
    file=$layout_dir/$scale-$dpi${size:+-$size}-$name.json
    dump_screen "$file" || { echo "  $name: no dump" >&2; return 1; }
    check_layout --width "$width" --density "$dpi" \
      --status-bar-bottom "$status_bottom" --navigation-bar-top "$nav_top" "$file" | sed 's/^/  /' || failed=1
    if $fits && [[ $name == *-home ]]; then
      local x y
      x=$((width / 2))
      y=$((nav_top / 2))
      "$adb" shell input swipe "$x" "$((y + y / 2))" "$x" "$((y / 2))" 300
      sleep 1
      dump_screen "${file%.json}-swiped.json" || return 1
      check_layout --unscrolled --width "$width" --density "$dpi" \
        --status-bar-bottom "$status_bottom" --navigation-bar-top "$nav_top" \
        "$file" "${file%.json}-swiped.json" | sed 's/^/  /' || failed=1
    fi
    checked=$((checked + 1))
    [[ $name != "$last" ]] || break
  done
  echo "  $checked screens checked"
  return "$failed"
}

layout_check() {
  local densities scale dpi failed=0
  layout_dir=$(mktemp -d "${TMPDIR:-/tmp}/flust-layout.XXXXXX")
  read -r -a densities < <(display_densities)
  local smallest=${densities[0]} default=${densities[1]} largest=${densities[-1]}
  if $full_matrix; then
    for scale in "${font_scales[@]}"; do
      for dpi in "${densities[@]}"; do
        layout_pass "$scale" "$dpi" || failed=1
      done
    done
  fi
  if $matrix; then
    if ! $full_matrix; then
      # The corners: the smallest text on the smallest display, the defaults, the largest text
      # before layouts change on the largest display, and the largest text on both extremes.
      layout_pass 0.85 "$smallest" || failed=1
      layout_pass 1.0 "$default" || failed=1
      layout_pass 1.3 "$largest" || failed=1
      layout_pass 2.0 "$smallest" || failed=1
      layout_pass 2.0 "$largest" || failed=1
    fi
    # The iPhone SE's height: 667 dp is 1334 pixels at 320 dpi, 750 pixels wide.
    layout_pass 1.0 320 750x1334 07-home || failed=1
  elif $layout; then
    local current=$previous_scale
    [[ $current != null ]] || current=1.0
    layout_pass "${font_scale:-$current}" "${density:-${densities[1]}}" || failed=1
  else
    layout_pass 1.0 "${densities[1]}" || failed=1
    layout_pass 2.0 "${densities[-1]}" || failed=1
  fi
  return "$failed"
}

if $layout || $matrix; then
  if layout_check; then status=0; else status=$?; fi
elif run_maestro "${flows[@]}" && { ! $recreate || { recreate_check && layout_check; }; }; then
  status=0
else
  status=$?
fi
exit "$status"
