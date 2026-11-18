# 0031 End-to-end tests

## Context

Unit tests cover the domain, storage and labels, but not the screens put together: navigation, the gates, the system dialogs and what a release build does without `INTERNET`. Until now, each release was checked by hand. A few journeys break silently when a screen changes, and checking them all by hand before each release is slow and uneven.

The test tool runs on a developer's machine and talks to an emulator. flust sends nothing off the device; the tool should not either, as far as it can be stopped.

## Decision

- [Maestro](https://github.com/mobile-dev-inc/maestro) runs the flows, pinned to version 2.12.1. It drives the app through the accessibility tree, so it needs no change to the app, no test build and no library in the bundle. Flows are YAML in `e2e/maestro/`.
- The flows run against the production-variant release APK built locally ([Release](../development/release.md#local-production-build)): what ships, with its blocked permissions and no Metro. `FLAG_SECURE` makes Maestro's failure screenshots black; the accessibility tree it reads is not affected. `waitForAnimationToEnd` compares screenshots, so it sees no change: flows wait for an element to appear or go instead.
- Each flow starts with the app's data cleared and runs the shared onboarding (`e2e/maestro/common/onboard.yaml`) in English, then one journey: home, emergency, lapse and undo, check-in, a journal note, a reminder, the app lock, help numbers, erasing everything. Selectors are the English texts and screen reader labels, so a flow also checks that a control has its label. A `testID` is added only where a text is ambiguous; none is needed yet.
- `scripts/e2e-android.sh` is the only way the flows run. It sets `MAESTRO_CLI_NO_ANALYTICS`, `MAESTRO_DISABLE_UPDATE_CHECK` and `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED`, the names read by the 2.12.1 source. The hosts Maestro reports to are also blocked on the development machine, which covers its crash reporter, the one report no variable turns off. It checks the APK with `scripts/check-android-release.sh`, refuses any device that is not an emulator, sets a screen lock PIN for the lock flow, and removes it and any font scale it changed at the end. It records the app's log from `adb logcat` during the run into a temporary file: the app's own lines, and the system's lines that name the package. The file is deleted when every flow passes, and its path printed otherwise, an interrupted run included.
- Maestro is installed from its GitHub release zip, checked against its published SHA-256, not through its `curl | bash` installer ([Setup](../development/setup.md#end-to-end-tests)).
- The flows run locally before each release ([Release](../development/release.md)), not in CI: emulator jobs are slow and flaky, and a failing run would be ignored. This is to be revisited when the VPN filter of version 0.2 makes device tests more valuable.
- What the flows cannot reach, such as safe mode, reboots, time zones or a screen reader, stays in a [manual checklist](../development/manual-checklist.md). Safe mode is triggered there by force-stopping the app during the splash screen twice, so no crash switch is added to the code.

## Consequences

- A release needs a local Android build and an emulator, on top of the EAS build.
- A text change on a screen can break a flow. The fix is in the same change, which also shows which journeys the change touches.
- Maestro's crash reporter has no setting to turn it off: when the CLI itself fails, it posts the stack trace and the command line to `api.copilot.mobile.dev`. That host, which also serves its update check, and `us.i.posthog.com`, its analytics, resolve to `0.0.0.0` and `::` through `/etc/hosts` on the development machine ([Setup](../development/setup.md#end-to-end-tests)), so the report never leaves it. Even if it did, the command line holds file paths and the `PIN` value hashed with SHA-256 and no salt, which a 4-digit PIN does not survive: it is the emulator's PIN, never a phone's, and no app data is in it, and nothing from the app or the emulator is sent. The hosts were read from the 2.12.1 source and must be checked again with each new version.
- Maestro saves its analytics choice in `~/.local/state/maestro/analytics.json` on its first run of any command, `maestro --version` included, and a later run without the variable follows that choice. The variables are exported in the shell profile before Maestro is installed, so the first run saves analytics as off; the script also sets them on every run.
- Maestro keeps the logs of each run in `~/.local/state/maestro/tests/`, with the text typed, the emulator PIN included, and the screen hierarchies. They stay on the machine.
- iOS has no flows yet. They come with the first iOS build, with the same files where the texts match.
