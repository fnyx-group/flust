import { createDatabase, type Database } from '@/data/database';
import { createJourneyRepository, type JourneyRepository } from '@/data/journey-repository';
import { applyMigrations, latestVersion, readUserVersion } from '@/data/migrate';
import { MIGRATIONS } from '@/data/migrations';
import type { Migration } from '@/data/migrations/migration';
import {
  createOnboardingRepository,
  type OnboardingRepository,
} from '@/data/onboarding-repository';
import { createRankRepository, type RankRepository } from '@/data/rank-repository';
import { createSettingsRepository, type SettingsRepository } from '@/data/settings-repository';
import {
  BACKUP_NAME,
  DATABASE_NAME,
  type DatabaseFiles,
  type StorageDeps,
} from '@/data/storage-deps';
import { createKey, readKey, type StorageKey } from '@/data/storage-key';
import { err, ok, type Result } from '@/domain/result';

export type Storage = {
  readonly journey: JourneyRepository;
  readonly ranks: RankRepository;
  readonly onboarding: OnboardingRepository;
  readonly settings: SettingsRepository;
  close(): Promise<void>;
};

// 'key-missing' and 'database-unreadable' mean the data can never be read again: only a reset
// helps. Every other error may be temporary and must not lead to a reset.
export type OpenStorageError =
  | 'key-unavailable'
  | 'key-missing'
  | 'database-unreadable'
  | 'cipher-unavailable'
  | 'schema-too-new'
  | 'migration-failed'
  | 'storage-unavailable';

type StorageResult = Result<Storage, OpenStorageError>;

export async function openStorage(
  deps: StorageDeps,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<StorageResult> {
  try {
    return await open(deps, migrations);
  } catch {
    return err('storage-unavailable');
  }
}

async function open(deps: StorageDeps, migrations: readonly Migration[]): Promise<StorageResult> {
  await restoreInterruptedMigration(deps.files);

  const key = await readKey(deps.keyStore);
  if (!key.ok) return key;

  if (!(await deps.files.exists(DATABASE_NAME))) {
    // A key without a database is stale: the iOS keychain outlives an uninstall, and a first
    // launch can stop between storing the key and creating the file.
    if (key.value !== null) await deps.keyStore.remove();
    const created = await createKey(deps.keyStore, deps.randomBytes);
    if (!created.ok) return created;
    return openWithKey(deps, created.value, migrations);
  }

  if (key.value === null) return err('key-missing');
  return openWithKey(deps, key.value, migrations);
}

// Writes only happen once storage is open, and the backup is gone by then, so a backup found at
// startup always holds the latest data.
async function restoreInterruptedMigration(files: DatabaseFiles): Promise<void> {
  if (await files.exists(BACKUP_NAME)) await restoreBackup(files);
}

// The database is removed first so that its journal files are never applied to the backup.
async function restoreBackup(files: DatabaseFiles): Promise<void> {
  await files.remove(DATABASE_NAME);
  await files.move(BACKUP_NAME, DATABASE_NAME);
}

async function openWithKey(
  deps: StorageDeps,
  key: StorageKey,
  migrations: readonly Migration[],
): Promise<StorageResult> {
  const opened = await connect(deps, key);
  if (!opened.ok) return opened;
  const { db, version } = opened.value;
  const latest = latestVersion(migrations);

  if (version === latest) return ok(toStorage(db));
  if (version > latest) {
    await closeQuietly(db);
    return err('schema-too-new');
  }
  if (version === 0) return migrateNew(deps.files, db, migrations);

  await db.close();
  await deps.files.copy(DATABASE_NAME, BACKUP_NAME);
  return migrateWithBackup(deps, key, migrations, version);
}

type Connected = { db: Database; version: number };

// SQLCipher reads nothing when the key is set: a wrong key or a damaged file only shows when
// pages are read, which quick_check does for the whole file.
async function connect(
  deps: StorageDeps,
  key: StorageKey,
): Promise<Result<Connected, OpenStorageError>> {
  let db: Database;
  try {
    db = createDatabase(await deps.driver.open(DATABASE_NAME, key));
  } catch {
    return err('database-unreadable');
  }
  try {
    const cipher = await db.all('PRAGMA cipher_version');
    if (cipher.length === 0) {
      await closeQuietly(db);
      return err('cipher-unavailable');
    }
    const check = await db.all('PRAGMA quick_check');
    const version = await readUserVersion(db);
    if (check[0]?.quick_check !== 'ok' || version === null) {
      await closeQuietly(db);
      return err('database-unreadable');
    }
    return ok({ db, version });
  } catch {
    await closeQuietly(db);
    return err('database-unreadable');
  }
}

// A database at version 0 holds no data yet. Removing it on failure lets the next launch start
// fresh instead of offering a reset for an empty file.
async function migrateNew(
  files: DatabaseFiles,
  db: Database,
  migrations: readonly Migration[],
): Promise<StorageResult> {
  try {
    await applyMigrations(db, migrations, 0);
    return ok(toStorage(db));
  } catch {
    await closeQuietly(db);
    await files.remove(DATABASE_NAME);
    return err('migration-failed');
  }
}

async function migrateWithBackup(
  deps: StorageDeps,
  key: StorageKey,
  migrations: readonly Migration[],
  from: number,
): Promise<StorageResult> {
  const db = createDatabase(await deps.driver.open(DATABASE_NAME, key));
  try {
    await applyMigrations(db, migrations, from);
  } catch {
    await closeQuietly(db);
    await restoreBackup(deps.files);
    return err('migration-failed');
  }
  try {
    await deps.files.remove(BACKUP_NAME);
  } catch {
    // A backup left behind would be restored on next launch, over any write made after this.
    await closeQuietly(db);
    return err('storage-unavailable');
  }
  return ok(toStorage(db));
}

function toStorage(db: Database): Storage {
  return {
    journey: createJourneyRepository(db),
    ranks: createRankRepository(db),
    onboarding: createOnboardingRepository(db),
    settings: createSettingsRepository(db),
    close: () => db.close(),
  };
}

async function closeQuietly(db: Database): Promise<void> {
  await db.close().catch(() => undefined);
}
