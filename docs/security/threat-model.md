# Threat model

flust helps people quit pornography. Its data reveals intimate behavior: exposure is a privacy harm in itself, and can lead to shame, discrimination or blackmail. The design goal is that this data never leaves the device and is unreadable without unlocking it.

## Sensitive data

- Journal entries.
- Streak and lapse history, with where, when and in what context each lapse happened.
- Emergency screen visits: when they started and ended, and how.
- Blocking configuration (blocked categories and domains).

## Threats and mitigations

| Threat                                                              | Mitigation                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data sent to a server, an analytics service or a third-party SDK    | No backend, no accounts, no ads, no analytics, no crash reporter. Network calls and data-collecting SDKs are forbidden (AGENTS.md).                                                                                                                                                                                                                    |
| Someone with access to the device or its file system reads the data | Data is encrypted at rest with keys held in Keychain / Android Keystore.                                                                                                                                                                                                                                                                               |
| Data extracted from a device backup                                 | The database is encrypted with SQLCipher. Its key is stored with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` and is never backed up or synced. Android backup and device-to-device transfer are disabled by `allowBackup="false"` and data extraction rules that exclude everything.                                                                         |
| A secret, key or token committed to the repository                  | `.gitignore` excludes key and env files. gitleaks scans staged changes in the pre-commit hook.                                                                                                                                                                                                                                                         |
| A compromised or malicious dependency                               | New dependencies must be justified and minimal. Dependency build scripts are denied by default (`pnpm-workspace.yaml`). Dependabot waits 7 days before proposing a release. CI installs from the lockfile only.                                                                                                                                        |
| Someone holding the unlocked phone opens flust                      | An optional lock asks for the device's biometrics or passcode, after a chosen delay in the background, with a growing wait between attempts. The content is covered as soon as the app leaves the foreground. A link or a notification tap waits for the unlock. See [0023](../decisions/0023-app-lock.md) and [0024](../decisions/0024-lock-wait.md). |
| A notification reveals what flust is about                          | Texts are neutral and have no title. They may show on the lock screen, depending on the device's settings: on Android when sensitive content is shown there, the default on most devices, and on iOS when previews are shown. The reminders screen explains how to hide previews on iOS.                                                               |
| A screenshot or the app switcher shows the content                  | In production builds, screenshots and screen recording are blocked and the recents preview is hidden on Android (`FLAG_SECURE`, set by `modules/flust-privacy`), and the app switcher preview is blurred on iOS ([0025](../decisions/0025-screen-privacy.md)).                                                                                         |
| A push service learns that the device runs flust                    | Notifications are local. iOS has no push entitlement; Android links no Firebase or Google Play services code ([0021](../decisions/0021-local-notifications.md)).                                                                                                                                                                                       |
| A notification tap reaches an unexpected screen                     | A tap carries only a route, checked against a fixed list (home, check-in). Android receivers are not exported.                                                                                                                                                                                                                                         |
| A compromised CI workflow                                           | Workflows run with `contents: read`, do not persist checkout credentials and pin actions by commit SHA.                                                                                                                                                                                                                                                |

## Known limitations

- On iOS, the encrypted database file is included in iCloud and computer backups: expo-file-system cannot set `isExcludedFromBackup` without custom native code. The backup holds ciphertext only, since the key is never backed up. A backup restored to another phone cannot be decrypted, and the app offers a reset. To check with iOS testing, and to fix with a native module if needed.
- The app lock is a gate in the interface, not a key: the data key is not bound to biometrics, so a lock bypass on a rooted or jailbroken device reads the data. This keeps data readable after biometric changes. Someone who knows the device passcode can open flust.
- The planned reminders are stored outside the encrypted database, in Android's no-backup storage and in iOS's notification center: their times and neutral texts only.
- In development builds only, expo-sqlite registers open databases with the Expo dev tools, which talk to the local development server. Release builds do not.

## Out of scope

- A device that is unlocked and in someone else's hands, beyond what the optional lock covers.
- A compromised operating system.
