# 0001 Local-first

## Context

flust stores journal entries, streak and relapse history, and blocking settings. This data is intimate: a leak is a direct harm to the user. Users are also more likely to trust and keep using a recovery app that cannot see their data.

## Decision

All user data stays on the device, encrypted at rest with keys held in the platform keystores (Keychain / Android Keystore). There are no accounts, no backend, no ads, no analytics and no third-party trackers. The app makes no network calls carrying user data.

## Consequences

- No server to run, secure or pay for, and no user data to lose in a breach.
- No sync between devices and no recovery if the device is lost, unless an export feature is added later.
- No usage analytics or remote crash reports: quality relies on tests and user feedback.
- Every new dependency must be checked for network activity.
