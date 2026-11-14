# Threat model

flust helps people quit pornography. Its data reveals intimate behavior: exposure is a privacy harm in itself, and can lead to shame, discrimination or blackmail. The design goal is that this data never leaves the device and is unreadable without unlocking it.

## Sensitive data

- Journal entries.
- Streak and lapse history, with where, when and in what context each lapse happened.
- Emergency screen visits: when they started and ended, and how.
- Blocking configuration (blocked categories and domains).

## Threats and mitigations

| Threat                                                              | Mitigation                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data sent to a server, an analytics service or a third-party SDK    | No backend, no accounts, no ads, no analytics, no crash reporter. Network calls and data-collecting SDKs are forbidden (AGENTS.md).                                                                                                                                            |
| Someone with access to the device or its file system reads the data | Data is encrypted at rest with keys held in Keychain / Android Keystore.                                                                                                                                                                                                       |
| Data extracted from a device backup                                 | The database is encrypted with SQLCipher. Its key is stored with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` and is never backed up or synced. Android backup and device-to-device transfer are disabled by `allowBackup="false"` and data extraction rules that exclude everything. |
| A secret, key or token committed to the repository                  | `.gitignore` excludes key and env files. gitleaks scans staged changes in the pre-commit hook.                                                                                                                                                                                 |
| A compromised or malicious dependency                               | New dependencies must be justified and minimal. Dependency build scripts are denied by default (`pnpm-workspace.yaml`). Dependabot waits 7 days before proposing a release. CI installs from the lockfile only.                                                                |
| A compromised CI workflow                                           | Workflows run with `contents: read`, do not persist checkout credentials and pin actions by commit SHA.                                                                                                                                                                        |

## Known limitations

- On iOS, the encrypted database file is included in iCloud and computer backups: expo-file-system cannot set `isExcludedFromBackup` without custom native code. The backup holds ciphertext only, since the key is never backed up. A backup restored to another phone cannot be decrypted, and the app offers a reset. To check with iOS testing, and to fix with a native module if needed.
- In development builds only, expo-sqlite registers open databases with the Expo dev tools, which talk to the local development server. Release builds do not.

## Out of scope

- A device that is unlocked and in someone else's hands.
- A compromised operating system.
