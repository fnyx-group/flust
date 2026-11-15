# Release

The checks before each store release, in order. A release that fails one is not submitted.

1. `main` is green in CI: typecheck, tests with coverage, lint, knip, format check, and the Kotlin tests.
2. The builds come from the `production` profile on EAS (see [Setup](setup.md#development-build)).
3. The Android build contains no Firebase, Google Play services or Install Referrer code, and no manifest entries for them ([0021](../decisions/0021-local-notifications.md)). Run the check on the APK or the bundle EAS produced:

       scripts/check-android-release.sh path/to/flust.aab

   It exits with an error and lists what it found.

4. The release goes out as a phased rollout on both stores ([Scenarios](../product/scenarios.md#production-incidents)).
