#!/usr/bin/env bash
# Regenerates src/features/settings/third-party-licenses.json from the release APK of the
# production prebuild: the Gradle release runtime classpath, the bundle's source map and the
# APK's native libraries (docs/decisions/0043-third-party-licenses.md). With --check, fails when
# the committed file differs instead of writing it. Build the APK first, as CI does:
#
#   APP_VARIANT=production pnpm expo prebuild --platform android --clean --no-install
#   (cd android && ./gradlew assembleRelease)
#
# Exits with 1 when a dependency has no license text or a license not allowed, or when the file
# is out of date, and with 2 when the build is missing or is not the production one.
# Usage: scripts/update-licenses.sh [--check]
set -euo pipefail

repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
android="$repository/android"
apk="$android/app/build/outputs/apk/release/app-release.apk"
sourcemap="$android/app/build/generated/sourcemaps/react/release/index.android.bundle.map"
report="$android/app/build/licenses/report.json"

if [[ ! -f $apk || ! -f $sourcemap ]]; then
  echo "No release APK or source map: build the production release first." >&2
  exit 2
fi

# The development variant ships other code, such as the development client: its notices would be
# wrong for the store build.
if ! grep -q "applicationId 'org.fnyxgroup.flust'" "$android/app/build.gradle"; then
  echo "android/ is not the production prebuild: run it with APP_VARIANT=production." >&2
  exit 2
fi

(cd "$android" && ./gradlew --quiet --init-script "$repository/scripts/licenses/report.gradle" \
  --no-configuration-cache :app:flustLicenseReport "-PflustLicenseReport=$report")

node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$repository/scripts/build-licenses.ts" \
  --sourcemap "$sourcemap" --android-report "$report" --apk "$apk" "$@"
