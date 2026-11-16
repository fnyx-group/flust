# Testing

## Tooling

Jest with the `jest-expo` preset, configured in `jest.config.js`. Run the suite with:

    pnpm test
    pnpm test:coverage   # with coverage thresholds, as in CI

CI runs it with coverage right after the typecheck. Network access fails any test, and `src/domain/` and `src/data/` have coverage thresholds: see [Conventions](conventions.md#tests).

## Network

flust makes no network calls ([0006](../decisions/0006-no-network-access.md)), checked three ways:

- `test/setup.ts` makes `fetch`, `XMLHttpRequest`, `WebSocket` and `EventSource` throw in every test, and fails the test even if the error is caught.
- `test/no-network-apis.test.ts` fails if any source file references them: TypeScript and JavaScript are parsed, so comments and longer names such as `prefetch` do not count. It also fails on a URL in the app's code outside the links handed to other apps. Kotlin and Swift sources are searched for the platform network APIs, and Java, Objective-C or C sources fail the test since they are not searched. Only the test setup is excluded.
- `app.config.test.ts` checks that production builds block `INTERNET` and the other unused permissions, and that `scripts/check-android-release.sh` blocks and expects the same permissions as `app.config.ts` ([0030](../decisions/0030-production-android-permissions.md)). The script itself runs on the built APK or bundle: see [Release](release.md).

These checks cover flust's own code, against mistakes rather than deliberate evasion. Dependencies are not scanned.

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

- SQL runs on `node:sqlite`, built into Node, in memory. `test/fakes/fake-disk.ts` models the database directory as serialized databases tagged with the key they were created with. Opening one with another key fails on the first read, as with SQLCipher, and a file can be damaged on purpose.
- `test/fakes/fake-key-store.ts` replaces the keystore and the random source. The keystore can fail on read, write or remove, or drop writes.
- `test/fakes/fake-storage.ts` wires both into the dependencies `openStorage` takes, and gives tests a second connection to set up or inspect rows.

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

## Where

Test files live next to the code they test: `streak.ts` -> `streak.test.ts`.
