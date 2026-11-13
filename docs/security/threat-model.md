# Threat model

flust helps people quit pornography. Its data reveals intimate behavior: exposure is a privacy harm in itself, and can lead to shame, discrimination or blackmail. The design goal is that this data never leaves the device and is unreadable without unlocking it.

## Sensitive data

- Journal entries.
- Streak and relapse history.
- Blocking configuration (blocked categories and domains).

## Threats and mitigations

| Threat                                                              | Mitigation                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data sent to a server, an analytics service or a third-party SDK    | No backend, no accounts, no ads, no analytics, no crash reporter. Network calls and data-collecting SDKs are forbidden (AGENTS.md).                                                                             |
| Someone with access to the device or its file system reads the data | Data is encrypted at rest with keys held in Keychain / Android Keystore.                                                                                                                                        |
| Data extracted from a device backup                                 | Stored data is encrypted. Keys stay in the platform keystore.                                                                                                                                                   |
| A secret, key or token committed to the repository                  | `.gitignore` excludes key and env files. gitleaks scans staged changes in the pre-commit hook.                                                                                                                  |
| A compromised or malicious dependency                               | New dependencies must be justified and minimal. Dependency build scripts are denied by default (`pnpm-workspace.yaml`). Dependabot waits 7 days before proposing a release. CI installs from the lockfile only. |
| A compromised CI workflow                                           | Workflows run with `contents: read`, do not persist checkout credentials and pin actions by commit SHA.                                                                                                         |

## Out of scope

- A device that is unlocked and in someone else's hands.
- A compromised operating system.
