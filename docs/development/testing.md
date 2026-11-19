# Testing

## Tooling

Jest with the `jest-expo` preset, configured in `jest.config.js`. Run the suite with:

    pnpm test
    pnpm test:coverage   # with coverage thresholds, as in CI

CI runs it with coverage right after the typecheck. Network access fails any test, and `src/domain/` and `src/data/` have coverage thresholds: see [Conventions](conventions.md#tests).

## CI

Three workflows run on pull requests and on `main`. Each job has a timeout and only the permissions it needs.

- `ci.yml`:
  - `checks`: typecheck, tests with coverage, lint, knip, format check and commitlint.
  - `kotlin`: the Kotlin JVM tests (see [Network](#network)).
  - `secrets`: gitleaks on the commits of the pull request, or on the full history on `main`.
  - `shellcheck`: `scripts/*.sh`.
  - `audit`: `pnpm audit --prod --audit-level moderate`.
  - `dependency-review`: the dependencies a pull request adds, failing on a moderate or worse advisory.
- `codeql.yml`: `codeql (javascript-typescript)` and `codeql (actions)`, also weekly.
- `native.yml`, also weekly, and on pull requests only when a native path changes (`native-paths` decides; see [0037](../decisions/0037-ci-native-builds.md)):
  - `android-release`: a production release APK, checked with `scripts/check-android-release.sh`.
  - `ios-build`: a production Release build for the simulator, without signing, checked with `scripts/check-ios-release.sh`. It is the only place the Swift code of `modules/` compiles before an EAS build.

## Network

flust makes no network calls ([0006](../decisions/0006-no-network-access.md)), checked three ways:

- `test/setup.ts` makes `fetch`, `XMLHttpRequest`, `WebSocket` and `EventSource` throw in every test, and fails the test even if the error is caught.
- `test/no-network-apis.test.ts` fails if any source file references them: TypeScript and JavaScript are parsed, so comments and longer names such as `prefetch` do not count. It also fails on a URL in the app's code outside the links handed to other apps. Kotlin and Swift sources are searched for the platform network APIs, and Java, Objective-C or C sources fail the test since they are not searched. Only the test setup is excluded.
- `app.config.test.ts` checks that production builds block `INTERNET` and the other unused permissions, and that `scripts/check-android-release.sh` blocks and expects the same permissions as `app.config.ts` ([0030](../decisions/0030-production-android-permissions.md)). The script itself runs on the built APK or bundle: see [Release](release.md).

These checks cover flust's own code, against mistakes rather than deliberate evasion. Dependencies are not scanned.

The release builds themselves are checked in CI on every change to a native path: see [CI](#ci).

The Kotlin tests of `modules/flust-reminders` run in their own CI job, on the JVM without the Android SDK:

    gradle --project-dir modules/flust-reminders/jvm-test test

They also run in the Android project, with `./gradlew :flust-reminders:testDebugUnitTest` from `android/`. The wall time cases in `test/fixtures/local-to-utc.tsv` are shared with the JS tests of `localToUtc`.

## What to test

Tests target business logic and sensitive code:

- encryption and key handling,
- storage,
- streak calculation,
- date handling (time zones, day boundaries).

What not to test:

- snapshots,
- trivial renders (a component that only displays its props),
- third-party libraries.

Every fixed bug gets a test that reproduces it.

## Storage

`src/data/` is tested without a device:

- SQL runs on `node:sqlite`, built into Node, in memory. `test/fakes/fake-disk.ts` models the database directory as serialized databases tagged with the key they were created with. Opening one with another key fails on the first read, as with SQLCipher. A file can be damaged on purpose, and a copy can be cut short halfway, as when the process dies during it.
- `test/fakes/fake-key-store.ts` replaces the keystore and the random source. The keystore can fail on read, write or remove, or drop writes.
- `test/fakes/fake-storage.ts` wires both into the dependencies `openStorage` takes, and gives tests a second connection to set up or inspect rows.
- `src/data/migrations/frozen-migrations.test.ts` records the SHA-256 of each published migration file and fails if one changes.

The adapters in `src/data/native/` only forward to Expo modules and are excluded from coverage. Encryption itself, the keystore and backups are checked by hand on devices:

1. After a first launch, pull the database (`adb exec-out run-as org.fnyxgroup.flust.dev cat files/SQLite/flust.db > flust.db`). `sqlite3 flust.db .tables` must fail with "file is not a database", and `strings` must show no data.
2. Relaunch: the data is still there.
3. Key missing, Android: expo-secure-store keeps its entries in the app's shared preferences. Delete them with `adb shell run-as org.fnyxgroup.flust.dev rm -r shared_prefs`, keeping `files/SQLite`, then relaunch. The reset screen appears, and erasing starts fresh.
4. Stale key, iOS: delete the app and install it again. It starts fresh without an error.
5. Damaged file: overwrite `files/SQLite/flust.db` with random bytes through `run-as`. The reset screen appears.
6. Migration: install a build at schema 1 and add data, then a build with a test migration 2. The data is kept. With a test migration that throws, the data is kept and the retry screen appears.
7. Migration interrupted: kill the app during a test migration that waits. The next launch restores the backup.
8. Backup, Android: `adb shell bmgr backupnow org.fnyxgroup.flust.dev` reports the app as not eligible, and the merged manifest has `allowBackup="false"` and `@xml/data_extraction_rules`.
9. Keystore before first unlock, iOS (real device): restart the phone, and launch the app before unlocking it, once a background launch exists. The retry screen appears, never the reset screen.
10. In airplane mode: a first launch and a relaunch work.
11. Error log: after an error, pull `files/diagnostics.bin` through `run-as`. `strings` must show nothing readable.
12. Safe mode: start the app and force-stop it during the splash screen twice (`adb shell am start -n org.fnyxgroup.flust.dev/.MainActivity`, then `adb shell am force-stop org.fnyxgroup.flust.dev`). The third launch opens safe mode. "Try again" starts normally; the report asks for the phone's authentication, then shows its text before the share sheet; erasing starts the onboarding. Then, with a screen error shown on the journal tab, switch tabs and open the report: the error is listed once, on the journal.

## Accessibility

`src/ui/theme.test.ts` checks the contrast of each listed text pair and shape, faded colors included, `src/ui/control-opacity.test.ts` that a disabled control stays faint, and ESLint requires a role on every `Pressable` and a label on every `TextInput` ([0032](../decisions/0032-accessibility-pass.md)). Layout at large text sizes and what a screen reader says are checked by hand, on Android with TalkBack and on iOS with VoiceOver:

1. Text scale 1.3, the largest before layouts change: the urge segmented control keeps its labels whole on one row, the rank names fit three columns, and the help and plan rows fit side by side.
2. Text scale 2.0: the urge segmented control stacks, wheel rows and tab labels fit, the rank grid shows two columns, the lock buttons can be reached, the reminder time chip keeps its padding, a long note title wraps, and the capped texts of the decision stay inside their places, the breathing phase name inside its ring.
3. Screen reader: each control is announced with its role and label, disabled buttons as disabled, the calendar days with their full date. Disabled buttons, the lapse undo button while it works included, look clearly fainter than available ones.
4. Reduce Motion (Remove animations on Android): screens fade instead of sliding, and the breathing circle keeps its size.

## End-to-end

Maestro flows in `e2e/maestro/` run the main journeys on the production release APK, on an Android emulator, before each release ([0031](../decisions/0031-end-to-end-tests.md)). They run locally only, not in CI. Set up Maestro and the emulator as in [Setup](setup.md#end-to-end-tests), build the APK as in [Release](release.md#local-production-build), then:

    scripts/e2e-android.sh                       # every flow
    scripts/e2e-android.sh e2e/maestro/flows/journal.yaml
    scripts/e2e-android.sh --font-scale 2.0      # every flow with the largest text

Each flow starts with the app's data cleared and goes through the onboarding in English (`common/onboard.yaml`), then checks one journey: the home screen, the emergency screen, a lapse and its undo, a check-in, a journal note written, edited and deleted, a reminder turned on and off, the app lock, the help numbers, and erasing everything. Selectors are the English texts and screen reader labels, and the emulator's system language must be English. The onboarding and erase flows also stop and relaunch the app, so the data is read back from storage. Nothing is dialed and nothing leaves the emulator.

The script checks the APK with `scripts/check-android-release.sh` first, refuses any device that is not an emulator (by its serial and its `qemu` property), and sets a screen lock PIN for the lock flow, removed at the end. When the emulator already has a screen lock, `E2E_PIN` must hold its PIN (`E2E_PIN=1234 scripts/e2e-android.sh`); the script then leaves the lock in place. It runs Maestro with its analytics, update check and test analysis notice turned off.

During the run, the script records the app's log from `adb logcat` into a temporary file: the app's own lines, and the system's lines that name the package, which show each start of the app's process and any death or restart. When a flow fails or the run is interrupted, the script prints the file's path; when every flow passes, it deletes the file. A flow that ends on an unexpected screen can then be checked for a process restart.

The script exits with 0 when every flow passes, with 1 when a flow fails or the release check finds something the build must not ship, and with 2 when it cannot run: a missing tool or APK, a bad option, not exactly one emulator, an `E2E_PIN` that does not match, or a release check that cannot read the build.

What the flows cannot check, such as safe mode, time zone changes or TalkBack, is in the [manual checklist](manual-checklist.md).

## Where

Test files live next to the code they test: `streak.ts` -> `streak.test.ts`.
