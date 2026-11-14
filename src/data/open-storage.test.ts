import { MIGRATIONS } from '@/data/migrations';
import type { Migration } from '@/data/migrations/migration';
import { openStorage } from '@/data/open-storage';
import { BACKUP_NAME, DATABASE_NAME } from '@/data/storage-deps';
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

      expect(copy).toHaveBeenCalledWith(DATABASE_NAME, BACKUP_NAME);
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
      expect(fake.disk.stored.get(DATABASE_NAME)).toBe(before);
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
});
