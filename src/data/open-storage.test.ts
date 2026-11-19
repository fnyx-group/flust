import { MIGRATIONS } from '@/data/migrations';
import type { Migration } from '@/data/migrations/migration';
import { openStorage } from '@/data/open-storage';
import { createDatabase } from '@/data/database';
import { BACKUP_NAME, BACKUP_TEMP_NAME, DATABASE_NAME } from '@/data/storage-deps';
import { isStorageKey } from '@/data/storage-key';
import { parseNoteContent } from '@/domain/journal';
import { err } from '@/domain/result';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { seedJourney } from '@test/seed';

const START = Date.UTC(2026, 0, 1);
const OTHER_KEY = 'cd'.repeat(32);

const CURRENT = MIGRATIONS.length;
const NEXT = CURRENT + 1;

const addExtraTable: Migration = {
  version: NEXT,
  async up(tx) {
    await tx.exec('CREATE TABLE extra (value INTEGER) STRICT');
  },
};

const failHalfway: Migration = {
  version: NEXT,
  async up(tx) {
    await tx.exec('CREATE TABLE extra (value INTEGER) STRICT');
    throw new Error('migration bug');
  },
};

function userVersion(fake: ReturnType<typeof createFakeStorage>): unknown {
  return fake.disk.query(DATABASE_NAME, 'PRAGMA user_version')[0]?.user_version;
}

// An existing installation at schema 1 with a journey saved.
async function installed() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  await storage.close();
  await seedJourney(fake, journeyOf(START, [START + 1000]));
  return fake;
}

const JOURNEY = journeyOf(START, [START + 1000]);

async function withBackup() {
  const fake = await installed();
  await fake.disk.files.copy(DATABASE_NAME, BACKUP_NAME);
  const discarded = jest.fn();
  return { fake, discarded, deps: { ...fake.deps, onBackupDiscarded: discarded } };
}

async function setBackupVersion(fake: ReturnType<typeof createFakeStorage>, version: number) {
  const key = fake.keyStore.value;
  if (!isStorageKey(key)) throw new Error('Expected a key');
  const backup = createDatabase(await fake.disk.driver.open(BACKUP_NAME, key));
  await backup.exec(`PRAGMA user_version = ${version}`);
  await backup.close();
}

// Makes the database differ from a backup taken before.
async function addHalfDoneTable(fake: ReturnType<typeof createFakeStorage>) {
  const raw = await fake.rawDatabase();
  await raw.exec('CREATE TABLE half_done (value INTEGER) STRICT');
  await raw.close();
}

function hasHalfDoneTable(fake: ReturnType<typeof createFakeStorage>): boolean {
  const rows = fake.disk.query(
    DATABASE_NAME,
    "SELECT name FROM sqlite_master WHERE name = 'half_done'",
  );
  return rows.length > 0;
}

describe('openStorage', () => {
  describe('first launch', () => {
    it('creates a key and an encrypted database at the latest schema', async () => {
      const fake = createFakeStorage();

      const storage = unwrap(await openStorage(fake.deps));

      expect(fake.keyStore.value).toMatch(/^[0-9a-f]{64}$/);
      expect(fake.disk.stored.get(DATABASE_NAME)?.key).toBe(fake.keyStore.value);
      expect(userVersion(fake)).toBe(MIGRATIONS.length);
      expect(unwrap(await storage.journey.load())).toBeNull();
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
    });

    it('creates nothing when the key cannot be stored', async () => {
      const fake = createFakeStorage();
      fake.keyStore.failSet = true;

      expect(await openStorage(fake.deps)).toEqual(err('key-unavailable'));
      expect(fake.disk.stored.size).toBe(0);
    });

    it('creates nothing when the keystore cannot be read', async () => {
      const fake = createFakeStorage();
      fake.keyStore.failGet = true;

      expect(await openStorage(fake.deps)).toEqual(err('key-unavailable'));
      expect(fake.disk.stored.size).toBe(0);
      expect(fake.randomBytes.calls).toBe(0);
    });

    it('removes the new database when its schema cannot be created, then starts fresh', async () => {
      const fake = createFakeStorage();
      const broken: Migration = {
        version: 1,
        async up() {
          throw new Error('migration bug');
        },
      };

      expect(await openStorage(fake.deps, [broken])).toEqual(err('migration-failed'));
      expect(fake.disk.stored.has(DATABASE_NAME)).toBe(false);
      expect(fake.disk.openConnections()).toBe(0);

      unwrap(await openStorage(fake.deps));
      expect(userVersion(fake)).toBe(MIGRATIONS.length);
    });

    it('refuses to create an unencrypted database', async () => {
      const fake = createFakeStorage({ withoutCipher: true });

      expect(await openStorage(fake.deps)).toEqual(err('cipher-unavailable'));
      expect(fake.disk.openConnections()).toBe(0);
    });
  });

  describe('normal launch', () => {
    it('opens the existing database with its key and keeps the data', async () => {
      const fake = await installed();
      const key = fake.keyStore.value;

      const storage = unwrap(await openStorage(fake.deps));

      expect(unwrap(await storage.journey.load())).toEqual(journeyOf(START, [START + 1000]));
      expect(fake.keyStore.value).toBe(key);
      expect(fake.randomBytes.calls).toBe(1);
    });

    it('reports a keystore that cannot be read without offering a reset', async () => {
      const fake = await installed();
      fake.keyStore.failGet = true;

      expect(await openStorage(fake.deps)).toEqual(err('key-unavailable'));
      fake.keyStore.failGet = false;
      unwrap(await openStorage(fake.deps));
    });

    it('migrates a database left at version 0 by an interrupted first launch', async () => {
      const fake = createFakeStorage();
      fake.keyStore.value = OTHER_KEY;
      await (await fake.rawDatabase()).close();

      unwrap(await openStorage(fake.deps));
      expect(userVersion(fake)).toBe(MIGRATIONS.length);
    });
  });

  describe('database present but key missing', () => {
    it('reports the missing key and leaves the file untouched', async () => {
      const fake = await installed();
      const file = fake.disk.stored.get(DATABASE_NAME);
      fake.keyStore.value = null;

      expect(await openStorage(fake.deps)).toEqual(err('key-missing'));
      expect(fake.disk.stored.get(DATABASE_NAME)).toBe(file);
      expect(fake.keyStore.value).toBeNull();
    });

    it('treats a malformed key as missing', async () => {
      const fake = await installed();
      fake.keyStore.value = 'garbage';

      expect(await openStorage(fake.deps)).toEqual(err('key-missing'));
    });
  });

  describe('key present but no database', () => {
    it('replaces the stale key and starts fresh', async () => {
      const fake = createFakeStorage();
      fake.keyStore.value = OTHER_KEY;

      unwrap(await openStorage(fake.deps));

      expect(fake.keyStore.value).not.toBe(OTHER_KEY);
      expect(fake.disk.stored.get(DATABASE_NAME)?.key).toBe(fake.keyStore.value);
    });

    it('fails without a reset when the stale key cannot be removed', async () => {
      const fake = createFakeStorage();
      fake.keyStore.value = OTHER_KEY;
      fake.keyStore.failRemove = true;

      expect(await openStorage(fake.deps)).toEqual(err('storage-unavailable'));
      expect(fake.disk.stored.size).toBe(0);
    });
  });

  describe('unreadable database', () => {
    it('reports a wrong key and leaves the file untouched', async () => {
      const fake = await installed();
      const file = fake.disk.stored.get(DATABASE_NAME);
      fake.keyStore.value = OTHER_KEY;

      expect(await openStorage(fake.deps)).toEqual(err('database-unreadable'));
      expect(fake.disk.stored.get(DATABASE_NAME)).toBe(file);
      expect(fake.disk.openConnections()).toBe(0);
    });

    it.each(['garbage', 'pages', 'freelist'] as const)(
      'reports a corrupted file (%s)',
      async (damage) => {
        const fake = await installed();
        fake.disk.damage(DATABASE_NAME, damage);

        expect(await openStorage(fake.deps)).toEqual(err('database-unreadable'));
        expect(fake.disk.openConnections()).toBe(0);
      },
    );

    it('reports a file that cannot be opened', async () => {
      const fake = await installed();
      fake.disk.failNext('open', DATABASE_NAME);

      expect(await openStorage(fake.deps)).toEqual(err('database-unreadable'));
    });

    it('reports a build without SQLCipher instead of reading the file as plain SQLite', async () => {
      const fake = await installed();
      const plain = createFakeStorage({ withoutCipher: true });
      const file = fake.disk.stored.get(DATABASE_NAME);
      if (!file) throw new Error('Expected an installed database');
      plain.disk.stored.set(DATABASE_NAME, file);
      plain.keyStore.value = fake.keyStore.value;

      expect(await openStorage(plain.deps)).toEqual(err('cipher-unavailable'));
      expect(plain.disk.openConnections()).toBe(0);
    });

    it('reports a file system that cannot be read', async () => {
      const fake = await installed();
      fake.disk.failNext('exists', DATABASE_NAME);

      expect(await openStorage(fake.deps)).toEqual(err('storage-unavailable'));
    });
  });

  describe('schema versions', () => {
    it('refuses a database from a newer version of the app and leaves it untouched', async () => {
      const fake = await installed();
      const raw = await fake.rawDatabase();
      await raw.exec('PRAGMA user_version = 99');
      await raw.close();
      const file = fake.disk.stored.get(DATABASE_NAME);

      expect(await openStorage(fake.deps)).toEqual(err('schema-too-new'));
      expect(fake.disk.stored.get(DATABASE_NAME)).toBe(file);
      expect(fake.disk.openConnections()).toBe(0);
    });

    it('backs up the database, migrates it, then removes the backup', async () => {
      const fake = await installed();
      const copy = jest.spyOn(fake.disk.files, 'copy');

      const storage = unwrap(await openStorage(fake.deps, [...MIGRATIONS, addExtraTable]));

      expect(copy).toHaveBeenCalledWith(DATABASE_NAME, BACKUP_TEMP_NAME);
      expect(userVersion(fake)).toBe(NEXT);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
      expect(unwrap(await storage.journey.load())).toEqual(journeyOf(START, [START + 1000]));
    });

    it('restores the backup when a migration fails', async () => {
      const fake = await installed();
      const before = fake.disk.stored.get(DATABASE_NAME);

      expect(await openStorage(fake.deps, [...MIGRATIONS, failHalfway])).toEqual(
        err('migration-failed'),
      );
      expect(fake.disk.stored.get(DATABASE_NAME)).toEqual(before);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
      expect(fake.disk.openConnections()).toBe(0);

      const storage = unwrap(await openStorage(fake.deps));
      expect(unwrap(await storage.journey.load())).toEqual(journeyOf(START, [START + 1000]));
    });

    it('does not migrate when the backup cannot be made', async () => {
      const fake = await installed();
      fake.disk.failNext('copy', DATABASE_NAME);

      expect(await openStorage(fake.deps, [...MIGRATIONS, addExtraTable])).toEqual(
        err('storage-unavailable'),
      );
      expect(userVersion(fake)).toBe(CURRENT);
    });

    it('restores the backup left by a migration that was interrupted', async () => {
      const fake = await installed();
      await fake.disk.files.copy(DATABASE_NAME, BACKUP_NAME);
      const raw = await fake.rawDatabase();
      await raw.exec(
        `CREATE TABLE half_done (value INTEGER) STRICT; PRAGMA user_version = ${NEXT}`,
      );
      await raw.close();

      unwrap(await openStorage(fake.deps, [...MIGRATIONS, addExtraTable]));

      expect(userVersion(fake)).toBe(NEXT);
      expect(
        fake.disk.query(DATABASE_NAME, "SELECT name FROM sqlite_master WHERE name = 'half_done'"),
      ).toEqual([]);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
    });

    it('stays closed when the backup cannot be removed, and recovers on next launch', async () => {
      const fake = await installed();
      fake.disk.failNext('remove', BACKUP_NAME);
      const migrations = [...MIGRATIONS, addExtraTable];

      expect(await openStorage(fake.deps, migrations)).toEqual(err('storage-unavailable'));
      expect(fake.disk.openConnections()).toBe(0);

      const storage = unwrap(await openStorage(fake.deps, migrations));
      expect(userVersion(fake)).toBe(NEXT);
      expect(unwrap(await storage.journey.load())).toEqual(journeyOf(START, [START + 1000]));
    });
  });

  describe('backup left by an interrupted migration', () => {
    const migrations = [...MIGRATIONS, addExtraTable];

    // Reproduces a backup copy cut short by the process dying: restoring it replaced the intact
    // database with a file that cannot be read.
    it('keeps the database and deletes a truncated backup', async () => {
      const { fake, discarded, deps } = await withBackup();
      fake.disk.damage(BACKUP_NAME, 'truncated');

      const storage = unwrap(await openStorage(deps));

      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
      expect(discarded).toHaveBeenCalledTimes(1);
      expect(fake.disk.openConnections()).toBe(1);
    });

    it('never restores a copy cut short, and migrates again on next launch', async () => {
      const fake = await installed();
      fake.disk.interruptNextCopy(DATABASE_NAME);

      expect(await openStorage(fake.deps, migrations)).toEqual(err('storage-unavailable'));
      expect(fake.disk.stored.has(BACKUP_TEMP_NAME)).toBe(true);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);

      const storage = unwrap(await openStorage(fake.deps, migrations));
      expect(userVersion(fake)).toBe(NEXT);
      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
      expect(fake.disk.stored.has(BACKUP_TEMP_NAME)).toBe(false);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
    });

    it('deletes a backup made with another key', async () => {
      const { fake, discarded, deps } = await withBackup();
      const backup = fake.disk.stored.get(BACKUP_NAME);
      if (!backup) throw new Error('Expected a backup');
      fake.disk.stored.set(BACKUP_NAME, { ...backup, key: OTHER_KEY });

      const storage = unwrap(await openStorage(deps));

      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
      expect(discarded).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['0', 0],
      ['above the latest known', CURRENT + 1],
    ])('deletes a backup at schema version %s', async (_, version) => {
      const { fake, discarded, deps } = await withBackup();
      await setBackupVersion(fake, version);

      const storage = unwrap(await openStorage(deps));

      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
      expect(userVersion(fake)).toBe(CURRENT);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
      expect(discarded).toHaveBeenCalledTimes(1);
    });

    it('restores a readable backup without reporting it', async () => {
      const { fake, discarded, deps } = await withBackup();
      const raw = await fake.rawDatabase();
      await raw.exec('CREATE TABLE half_done (value INTEGER) STRICT');
      await raw.close();

      unwrap(await openStorage(deps));

      expect(
        fake.disk.query(DATABASE_NAME, "SELECT name FROM sqlite_master WHERE name = 'half_done'"),
      ).toEqual([]);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
      expect(discarded).not.toHaveBeenCalled();
    });

    it('touches neither file while the key is missing', async () => {
      const { fake, discarded, deps } = await withBackup();
      await addHalfDoneTable(fake);
      const database = fake.disk.stored.get(DATABASE_NAME);
      const backup = fake.disk.stored.get(BACKUP_NAME);
      fake.keyStore.value = null;

      expect(await openStorage(deps)).toEqual(err('key-missing'));
      expect(fake.disk.stored.get(DATABASE_NAME)).toBe(database);
      expect(hasHalfDoneTable(fake)).toBe(true);
      expect(fake.disk.stored.get(BACKUP_NAME)).toBe(backup);
      expect(discarded).not.toHaveBeenCalled();
    });

    it('touches neither file while the keystore cannot be read', async () => {
      const { fake, deps } = await withBackup();
      const backup = fake.disk.stored.get(BACKUP_NAME);
      fake.keyStore.failGet = true;

      expect(await openStorage(deps)).toEqual(err('key-unavailable'));
      expect(fake.disk.stored.get(BACKUP_NAME)).toBe(backup);
    });

    it('keeps the backup on a build without SQLCipher', async () => {
      const { fake } = await withBackup();
      const plain = createFakeStorage({ withoutCipher: true });
      for (const [name, file] of fake.disk.stored) plain.disk.stored.set(name, file);
      plain.keyStore.value = fake.keyStore.value;

      expect(await openStorage(plain.deps)).toEqual(err('cipher-unavailable'));
      expect(plain.disk.stored.has(BACKUP_NAME)).toBe(true);
      expect(plain.disk.openConnections()).toBe(0);
    });

    it('keeps a backup left without a key or a database, and never starts fresh', async () => {
      const { fake, deps } = await withBackup();
      const backup = fake.disk.stored.get(BACKUP_NAME);
      fake.disk.stored.delete(DATABASE_NAME);
      fake.keyStore.value = null;

      expect(await openStorage(deps)).toEqual(err('key-missing'));
      expect(fake.disk.stored.get(BACKUP_NAME)).toBe(backup);
      expect(fake.disk.stored.has(DATABASE_NAME)).toBe(false);
      expect(fake.keyStore.value).toBeNull();
    });
  });

  // A restore cut short between removing the database and renaming the backup leaves the backup
  // as the only copy of the data.
  describe('backup left without a database', () => {
    async function onlyBackup() {
      const { fake, discarded, deps } = await withBackup();
      fake.disk.stored.delete(DATABASE_NAME);
      return { fake, discarded, deps, key: fake.keyStore.value };
    }

    function expectUntouched(
      fake: ReturnType<typeof createFakeStorage>,
      key: string | null,
      backup: unknown,
    ) {
      expect(fake.disk.stored.get(BACKUP_NAME)).toBe(backup);
      expect(fake.disk.stored.has(DATABASE_NAME)).toBe(false);
      expect(fake.keyStore.value).toBe(key);
      expect(fake.randomBytes.calls).toBe(1);
      expect(fake.disk.openConnections()).toBe(0);
    }

    it('restores the backup', async () => {
      const { fake, discarded, deps, key } = await onlyBackup();

      const storage = unwrap(await openStorage(deps));

      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
      expect(fake.keyStore.value).toBe(key);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(false);
      expect(discarded).not.toHaveBeenCalled();
    });

    it('keeps every file and the key when the backup cannot be read for now', async () => {
      const { fake, discarded, deps, key } = await onlyBackup();
      const backup = fake.disk.stored.get(BACKUP_NAME);
      fake.disk.failNext('open', BACKUP_NAME);

      expect(await openStorage(deps)).toEqual(err('storage-unavailable'));
      expectUntouched(fake, key, backup);
      expect(discarded).not.toHaveBeenCalled();

      const storage = unwrap(await openStorage(deps));
      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
    });

    it.each(['truncated', 'pages'] as const)(
      'keeps every file and the key when the backup is damaged (%s)',
      async (damage) => {
        const { fake, discarded, deps, key } = await onlyBackup();
        fake.disk.damage(BACKUP_NAME, damage);
        const backup = fake.disk.stored.get(BACKUP_NAME);

        expect(await openStorage(deps)).toEqual(err('storage-unavailable'));
        expectUntouched(fake, key, backup);
        expect(await openStorage(deps)).toEqual(err('storage-unavailable'));
        expectUntouched(fake, key, backup);
        expect(discarded).not.toHaveBeenCalled();
      },
    );

    it('keeps every file and the key when the backup has a schema this build does not know', async () => {
      const { fake, deps, key } = await onlyBackup();
      await setBackupVersion(fake, CURRENT + 1);
      const backup = fake.disk.stored.get(BACKUP_NAME);

      expect(await openStorage(deps)).toEqual(err('storage-unavailable'));
      expectUntouched(fake, key, backup);
    });

    it('recovers from a restore cut short after a failed migration', async () => {
      const fake = await installed();
      fake.disk.failNext('move', BACKUP_NAME);

      expect(await openStorage(fake.deps, [...MIGRATIONS, failHalfway])).toEqual(
        err('storage-unavailable'),
      );
      expect(fake.disk.stored.has(DATABASE_NAME)).toBe(false);

      const storage = unwrap(await openStorage(fake.deps));
      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
      expect(userVersion(fake)).toBe(CURRENT);
    });
  });

  // SQLite applies a journal it finds next to a database to that database, whatever file it was
  // written for.
  describe('side files', () => {
    const JOURNAL = `${DATABASE_NAME}-journal`;

    // A journal holding pages of the half-migrated database.
    async function halfMigratedJournal(fake: ReturnType<typeof createFakeStorage>) {
      const database = fake.disk.stored.get(DATABASE_NAME);
      await addHalfDoneTable(fake);
      const journal = fake.disk.stored.get(DATABASE_NAME);
      if (!database || !journal) throw new Error('Expected a database');
      fake.disk.stored.set(DATABASE_NAME, database);
      fake.disk.stored.set(JOURNAL, journal);
    }

    it('restores the backup cleanly after the app died between deleting the database and its journal', async () => {
      const { fake, deps } = await withBackup();
      await halfMigratedJournal(fake);
      fake.disk.stored.delete(DATABASE_NAME);

      const storage = unwrap(await openStorage(deps));

      expect(hasHalfDoneTable(fake)).toBe(false);
      expect(fake.disk.stored.has(JOURNAL)).toBe(false);
      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
    });

    it('removes the journal before the database, so dying in between leaves none behind', async () => {
      const { fake, deps } = await withBackup();
      await halfMigratedJournal(fake);
      fake.disk.failNext('remove', DATABASE_NAME);

      expect(await openStorage(deps)).toEqual(err('storage-unavailable'));
      expect(fake.disk.stored.has(JOURNAL)).toBe(false);
      expect(fake.disk.stored.has(DATABASE_NAME)).toBe(true);
      expect(fake.disk.stored.has(BACKUP_NAME)).toBe(true);

      const storage = unwrap(await openStorage(deps));
      expect(hasHalfDoneTable(fake)).toBe(false);
      expect(unwrap(await storage.journey.load())).toEqual(JOURNEY);
    });

    it('starts fresh without applying a journal left by a database deleted halfway', async () => {
      const fake = await installed();
      await halfMigratedJournal(fake);
      fake.disk.stored.delete(DATABASE_NAME);

      const storage = unwrap(await openStorage(fake.deps));

      expect(fake.disk.stored.has(JOURNAL)).toBe(false);
      expect(hasHalfDoneTable(fake)).toBe(false);
      expect(unwrap(await storage.journey.load())).toBeNull();
    });
  });

  // Deleted text must not stay readable in free pages, even encrypted: the delete sheet says the
  // note is erased from the phone.
  describe('secure delete', () => {
    const SECRET = 'a-private-sentence-to-erase';

    function fileHolds(fake: ReturnType<typeof createFakeStorage>, text: string): boolean {
      const bytes = fake.disk.stored.get(DATABASE_NAME)?.bytes ?? new Uint8Array();
      return Buffer.from(bytes).includes(text);
    }

    async function writeThenDelete(storage: Awaited<ReturnType<typeof openStorage>>) {
      const opened = unwrap(storage);
      const content = unwrap(parseNoteContent({ title: '', body: SECRET.repeat(20) }));
      const note = unwrap(await opened.journal.create({ day: 0, at: START, offset: 0 }, content));
      unwrap(await opened.journal.remove(note.id));
      return opened;
    }

    it('erases deleted rows from a new database', async () => {
      const fake = createFakeStorage();
      const storage = await writeThenDelete(await openStorage(fake.deps));
      expect(fileHolds(fake, SECRET)).toBe(false);
      await storage.close();
    });

    it('erases deleted rows from a database opened again', async () => {
      const fake = await installed();
      const storage = await writeThenDelete(await openStorage(fake.deps));
      expect(fileHolds(fake, SECRET)).toBe(false);
      await storage.close();
    });

    it('erases deleted rows from a database just migrated', async () => {
      const fake = await installed();
      const storage = await writeThenDelete(
        await openStorage(fake.deps, [...MIGRATIONS, addExtraTable]),
      );
      expect(fileHolds(fake, SECRET)).toBe(false);
      await storage.close();
    });
  });
});
