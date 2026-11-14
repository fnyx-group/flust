import * as fc from 'fast-check';

import { openStorage, type Storage } from '@/data/open-storage';
import { err, ok } from '@/domain/result';
import { journeyFrom, journeyInput, journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const START = Date.UTC(2026, 0, 1);

async function setUp() {
  const fake = createFakeStorage();
  const storage: Storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('journey repository', () => {
  it('loads nothing before a journey is saved', async () => {
    const { storage } = await setUp();
    expect(await storage.journey.load()).toEqual(ok(null));
  });

  it('loads every journey it saved, lapses sorted and duplicates kept', async () => {
    await fc.assert(
      fc.asyncProperty(journeyInput, async (input) => {
        const { storage } = await setUp();
        const journey = journeyFrom(input);

        expect(await storage.journey.save(journey)).toEqual(ok(undefined));
        expect(await storage.journey.load()).toEqual(ok(journey));
      }),
      { numRuns: 50 },
    );
  });

  it('replaces the previous journey', async () => {
    const { storage } = await setUp();
    unwrap(await storage.journey.save(journeyOf(START, [START + 10, START + 20])));

    unwrap(await storage.journey.save(journeyOf(START + 5, [START + 30])));

    expect(await storage.journey.load()).toEqual(ok(journeyOf(START + 5, [START + 30])));
  });

  it('keeps the previous journey when a save is interrupted', async () => {
    const { storage, rawDatabase } = await setUp();
    unwrap(await storage.journey.save(journeyOf(START, [START + 10])));
    const raw = await rawDatabase();
    await raw.exec(`
      CREATE TRIGGER fail_on_second_lapse BEFORE INSERT ON lapse
      WHEN (SELECT count(*) FROM lapse) = 1
      BEGIN SELECT RAISE(ABORT, 'disk full'); END;
    `);
    await raw.close();

    expect(await storage.journey.save(journeyOf(START + 1, [START + 2, START + 3]))).toEqual(
      err('storage-failed'),
    );
    expect(await storage.journey.load()).toEqual(ok(journeyOf(START, [START + 10])));
  });

  it('reports a lapse stored before the start as corrupted', async () => {
    const { storage, rawDatabase } = await setUp();
    unwrap(await storage.journey.save(journeyOf(START)));
    const raw = await rawDatabase();
    await raw.run('INSERT INTO lapse (at) VALUES (?)', [START - 1]);
    await raw.close();

    expect(await storage.journey.load()).toEqual(err('journey-corrupted'));
  });

  it('reports an invalid stored timestamp as corrupted', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.run('INSERT INTO journey (id, start_at) VALUES (1, ?)', [-5]);
    await raw.close();

    expect(await storage.journey.load()).toEqual(err('journey-corrupted'));
  });

  it('reports a value of the wrong type as corrupted', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.exec(`
      DROP TABLE lapse;
      CREATE TABLE lapse (id INTEGER PRIMARY KEY, at ANY NOT NULL) STRICT;
      INSERT INTO journey (id, start_at) VALUES (1, ${START});
      INSERT INTO lapse (at) VALUES ('yesterday');
    `);
    await raw.close();

    expect(await storage.journey.load()).toEqual(err('journey-corrupted'));
  });

  it('reports storage errors', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.journey.load()).toEqual(err('storage-failed'));
    expect(await storage.journey.save(journeyOf(START))).toEqual(err('storage-failed'));
  });
});
