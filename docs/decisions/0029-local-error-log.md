# 0029 Local error log

## Context

[0006](0006-no-network-access.md) replaces remote crash reporting with a local log the person can export and send by hand. Error messages are not safe to keep: a SQL error can carry a value, a validation error a piece of a note or a plan. The log must also be readable in safe mode ([0028](0028-error-boundaries-and-safe-mode.md)), when the database itself may be what fails.

## Decision

- Each entry keeps only fields that match a strict pattern: the time (UTC milliseconds), the kind (`render`, `fatal`, `uncaught`, `unhandled-rejection`, `storage-failure`), the route as the failing screen's name from React Navigation's `useRoute()`, the file's pattern relative to its layout, with a parameter as `[id]` and never its value, and with any segment made only of digits, longer than 24 characters or holding four digits or more dropped as a possible id or token, the error's class name, a flust error code such as `key-unavailable`, and up to 15 stack frames as `function@file:line:column`, with the file name only. Never the message. Anything that does not match is dropped, when recording and again when reading the file (`src/domain/error-log.ts`). The log holds no reason, plan, note, check-in value or other user content.
- The last 50 entries are kept.
- The log is a file of its own, `diagnostics.bin`, outside the database, so it can be read when the database cannot. It is encrypted with AES-GCM through `expo-crypto`, which flust already uses, with its own 256-bit key in the platform keystore (`diagnostics-key`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). The file is written whole through a temporary file and a move, one write at a time.
- Entries are also kept in memory for the running session. While the keystore cannot be read, such as before the first unlock, they stay in memory and the file is left as it is; they are written once the key is readable. A file that cannot be decrypted is replaced on the next write. A file that cannot be read is left as it is, and entries stay in memory until a later read succeeds, so a passing failure never loses the log.
- The report is plain English text, whatever the app language, since it is meant for whoever fixes the bug. It adds the app version, the platform and the OS version.
- The report screen, from About and from safe mode, shows the exact text before the share sheet opens, so the person can check that it holds nothing personal. From About it sits behind the lock; from safe mode it first asks for the device's authentication ([0028](0028-error-boundaries-and-safe-mode.md)). It is shared as text through React Native's `Share`, with no file written. Lint allows `Share` in `src/features/errors/share-report.ts` only.
- Erasing everything deletes the log and its key, and the launch counter. The log is paused for the whole erase, so an error during it keeps its entry in memory and creates no new key or file. Resetting a database that cannot be decrypted does not erase the log: the log explains why it happened.

## Consequences

- Nothing leaves the device unless the person shares the report, and they see it first.
- Release stacks are minified: reading them needs the source maps of that release, which are kept with the release, never in the app.
- The times of errors stay in the report. They are needed to match errors with a description, and the person sees them before sharing.
- On iOS, the encrypted log is included in device backups like the database, without its key ([threat model](../security/threat-model.md)).
- The log adds a second key to the keystore and a small file to the app's documents.
