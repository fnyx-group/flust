# shellcheck shell=bash
# The bundletool release that CI downloads and that the Android release scripts accept, sourced by
# .github/workflows/native.yml, scripts/check-android-release.sh and scripts/build-android-bundle.sh,
# and named in docs/development/setup.md. Dependabot does not update it: change the version and the
# hash together, the hash taken from the release page.
BUNDLETOOL_VERSION=1.18.3
BUNDLETOOL_SHA256=a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29

# Prints why the jar at $BUNDLETOOL cannot be used, and fails, when it is missing or is not the
# pinned release.
bundletool_problem() {
  if [[ -z ${BUNDLETOOL:-} || ! -f $BUNDLETOOL ]]; then
    echo "bundletool not found: set BUNDLETOOL to the bundletool $BUNDLETOOL_VERSION jar (docs/development/setup.md#android-build-tools)."
    return 1
  fi
  local actual
  actual=$(sha256sum <"$BUNDLETOOL" | cut -d ' ' -f 1) || {
    echo "Cannot hash $BUNDLETOOL."
    return 1
  }
  if [[ $actual != "$BUNDLETOOL_SHA256" ]]; then
    echo "$BUNDLETOOL is not bundletool $BUNDLETOOL_VERSION: its SHA-256 is $actual, not $BUNDLETOOL_SHA256 (scripts/bundletool.sh)."
    return 1
  fi
}
