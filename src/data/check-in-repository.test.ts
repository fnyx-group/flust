import { openStorage } from '@/data/open-storage';
import type { CheckInAnswers, CheckInNote } from '@/domain/check-in';
import { localDayNumber } from '@/domain/local-time';
import { err, ok } from '@/domain/result';
import { MS_PER_HOUR } from '@/domain/time';
import { unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { zoneOffsetAt } from '@test/zones';

const DAY = 20_000;
const AT = Date.UTC(2026, 10, 14, 20);

const answers: CheckInAnswers = {
  mood: 2,
  urge: 'strong',
  context: ['stress', 'after-social-media'],
  note: 'Long day.' as CheckInNote,
};

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('check-in repository', () => {
  it('stores a check-in and returns it as stored', async () => {
    const { storage } = await setUp();
    const saved = await storage.checkIns.save(DAY, AT, answers);

    const expected = { ...answers, day: DAY, recordedAt: AT, updatedAt: AT };
    expect(saved).toEqual(ok(expected));
    expect(await storage.checkIns.since(DAY)).toEqual(ok([expected]));
  });

  it('updates the check-in of the same day and keeps its time of recording', async () => {
    const { storage } = await setUp();
    unwrap(await storage.checkIns.save(DAY, AT, answers));
    const edited: CheckInAnswers = { mood: 4, urge: 'none', context: [], note: null };

    expect(await storage.checkIns.save(DAY, AT + MS_PER_HOUR, edited)).toEqual(
      ok({ ...edited, day: DAY, recordedAt: AT, updatedAt: AT + MS_PER_HOUR }),
    );
    expect(unwrap(await storage.checkIns.since(DAY))).toHaveLength(1);
  });

  it('keeps one check-in per day, the latest day first', async () => {
    const { storage } = await setUp();
    unwrap(await storage.checkIns.save(DAY - 2, AT, answers));
    unwrap(await storage.checkIns.save(DAY, AT, answers));
    unwrap(await storage.checkIns.save(DAY - 1, AT, answers));

    const days = unwrap(await storage.checkIns.since(DAY - 1)).map((checkIn) => checkIn.day);
    expect(days).toEqual([DAY, DAY - 1]);
  });

  // The day is stored, never recomputed from the time of recording in the current time zone.
  it('keeps a check-in on the local day it was saved on after a time zone change', async () => {
    const { storage } = await setUp();
    const lateInParis = Date.UTC(2026, 10, 12, 22, 30);
    const parisDay = localDayNumber(lateInParis, zoneOffsetAt('Europe/Paris'));
    unwrap(await storage.checkIns.save(parisDay, lateInParis, answers));

    const inTokyo = localDayNumber(lateInParis, zoneOffsetAt('Asia/Tokyo'));
    expect(inTokyo).toBe(parisDay + 1);
    expect(unwrap(await storage.checkIns.since(parisDay)).map((checkIn) => checkIn.day)).toEqual([
      parisDay,
    ]);
  });

  it('leaves out rows that fail validation', async () => {
    const { storage, rawDatabase } = await setUp();
    unwrap(await storage.checkIns.save(DAY, AT, answers));
    const raw = await rawDatabase();
    await raw.run(
      `INSERT INTO check_in (local_day, recorded_at, updated_at, mood, urge_level, context)
       VALUES (?, ?, ?, 1, 'none', '["unknown"]'), (?, ?, ?, 1, 'none', 'not json')`,
      [DAY - 1, AT, AT, DAY - 2, AT, AT],
    );
    await raw.close();

    expect(unwrap(await storage.checkIns.since(0)).map((checkIn) => checkIn.day)).toEqual([DAY]);
  });

  it('rolls a save back when the stored row cannot be read back', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.run(
      `INSERT INTO check_in (local_day, recorded_at, updated_at, mood, urge_level, context)
       VALUES (?, -5, -5, 1, 'none', '[]')`,
      [DAY],
    );
    await raw.close();

    expect(await storage.checkIns.save(DAY, AT, answers)).toEqual(err('storage-failed'));
    expect(await storage.checkIns.since(DAY)).toEqual(ok([]));
  });

  it('reports storage failures', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await storage.checkIns.save(DAY, AT, answers)).toEqual(err('storage-failed'));
    expect(await storage.checkIns.since(DAY)).toEqual(err('storage-failed'));
  });
});
