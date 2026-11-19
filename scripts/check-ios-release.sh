#!/usr/bin/env bash
# Fails when an iOS build registers a URL scheme: a CFBundleURLTypes entry in the Info.plist of the
# built app (docs/decisions/0035-no-url-scheme-in-production.md). Runs on macOS, where plutil is.
# Exits with 1 when the build registers a URL scheme, 2 when it cannot be checked.
# Usage: scripts/check-ios-release.sh <flust.app>
set -euo pipefail

cannot_check() {
  echo "$1" >&2
  exit 2
}

[[ $# -eq 1 && -d $1 ]] || cannot_check "Usage: $0 <flust.app>"
plist=$1/Info.plist
[[ -f $plist ]] || cannot_check "No Info.plist in $1"
command -v plutil >/dev/null || cannot_check "plutil not found: run this on macOS."
plutil -lint "$plist" >/dev/null || cannot_check "Cannot read $plist"

if url_types=$(plutil -extract CFBundleURLTypes json -o - "$plist" 2>/dev/null); then
  echo "$1 registers URL schemes, which let any web page detect or open flust:" >&2
  echo "  $url_types" >&2
  exit 1
fi

echo "$1: no URL scheme."
