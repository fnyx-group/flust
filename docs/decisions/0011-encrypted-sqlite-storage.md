# 0011 Encrypted SQLite storage

## Context

[0001 Local-first](0001-local-first.md) requires user data to be encrypted at rest with keys held by the platform keystores. The data is relational (a journey, its lapses, unlocked ranks, settings, and later journal entries), and its schema will change across releases. Storage must also survive the cases a phone goes through: an iOS keychain that outlives an uninstall, a phone restored from a backup without its keys, a damaged file, an update that changes the schema, an app downgraded after one.

## Decision

- Data is stored in one SQLite database, `flust.db`, through `expo-sqlite` with SQLCipher enabled by its config plugin (`useSQLCipher`).
- The database key is 32 bytes from `expo-crypto`, stored as hex by `expo-secure-store` with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: readable once the phone has been unlocked after a restart, never synced, never restored to another device. It is passed to SQLCipher in raw form (`PRAGMA key = "x'...'"`), which skips key derivation: the key is already random.
- The app refuses to open or create a database when `PRAGMA cipher_version` is empty, so a build without SQLCipher can never write plain data.
- Startup is a state machine (`src/data/open-storage.ts`) with one outcome per case:

  | Case                                    | Outcome                                                            |
  | --------------------------------------- | ------------------------------------------------------------------ |
  | No key, no database                     | First launch: create the key, then the database.                   |
  | Key and database                        | Normal launch: open, check with `quick_check`, migrate if needed.  |
  | Database but no key                     | `key-missing`: a reset is offered.                                 |
  | Key but no database                     | The stale key is replaced and the app starts fresh.                |
  | Wrong key or damaged file               | `database-unreadable`: a reset is offered.                         |
  | Keystore not readable yet               | `key-unavailable`: retry only. A reset here could erase good data. |
  | Database from a newer app version       | `schema-too-new`: retry only, the data is kept for the update.     |
  | Migration failed                        | `migration-failed`: the backup is restored, retry only.            |
  | File system or keystore error otherwise | `storage-unavailable`: retry only.                                 |
  | Journey stored but invalid              | `journey-corrupted`: a reset is offered, after storage is closed.  |

  Each step is ordered so that a process killed at any point leads to one of these cases on next launch.

- The schema version is `PRAGMA user_version`. Before migrating a database that holds data, the app closes it and copies the file to `flust.db.pre-migration`. Each migration runs in a transaction together with its version number. On failure the database is replaced by the copy. A copy found at startup means a migration was interrupted, and it is restored before anything else; this is safe because no write happens before storage is open, and the copy is removed before it opens.
- Every write runs in a transaction. All statements go through a single connection and a queue, so a transaction never picks up a statement issued elsewhere. expo-sqlite's exclusive transactions are not used: each one opens a new connection, which SQLCipher would need to key again.
- Repositories (`src/data/*-repository.ts`) read rows through the domain validators (`restoreJourney`, `isRankId`) and return `Result` types. Features reach them through `useStorage()`, provided by `StorageGate` in the root layout, which also shows the reset and retry screens.
- A reset deletes the backup, then the database, then the key, and asks for two explicit confirmations.
- Android backup is off: `allowBackup` is false, and a local config plugin (`plugins/with-android-no-backup.ts`) adds data extraction rules that exclude every domain from cloud backup and device-to-device transfer, which Android 12 and later perform even when `allowBackup` is false.

## Consequences

- Data at rest is unreadable without the key, and the key never leaves the phone. A restored or transferred database cannot be decrypted, so the app offers a reset rather than crashing.
- There is no way to recover data once the key is lost. Export, if added later, is the only way to move data between phones.
- On iOS the encrypted database is included in device backups, because expo-file-system cannot exclude a file from backup without custom native code. The key is not, so a backup restored to another phone ends in a reset. See the [threat model](../security/threat-model.md).
- Later lots add their tables through new migrations. A released migration is never edited.
- Tests run the real SQL on `node:sqlite` in memory, with fakes for the keystore, random bytes and files; SQLCipher itself is checked by hand on devices (see [Testing](../development/testing.md)).
- The four Expo modules are native: adding them required a new development build.
