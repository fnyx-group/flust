import { MIGRATIONS } from '@/data/migrations';
import { initial } from '@/data/migrations/0001-initial';
import { onboarding } from '@/data/migrations/0002-onboarding';
import { lapsesAndUrges } from '@/data/migrations/0003-lapses-and-urges';
import { checkIns } from '@/data/migrations/0004-check-ins';
import { openStorage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { EMPTY_DRAFT } from '@/domain/onboarding';
import { ok } from '@/domain/result';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { seedJourney } from '@test/seed';

describe('migrations', () => {
  it('are numbered 1, 2, 3 and so on, in order', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual(
      MIGRATIONS.map((_, index) => index + 1),
    );
  });

  it('create the tables the repositories use, and only those', async () => {
    const fake = createFakeStorage();
    unwrap(await openStorage(fake.deps));

    const tables = fake.disk
      .query(DATABASE_NAME, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((row) => row.name);

    expect(tables).toEqual([
      'check_in',
      'journal_note',
      'journey',
      'lapse',
      'lapse_detail',
      'onboarding_draft',
      'plan',
      'reason',
      'risk_moment',
      'setting',
      'unlocked_rank',
      'urge_event',
    ]);
  });

  it('allow a single journey row', async () => {
    const fake = createFakeStorage();
    unwrap(await openStorage(fake.deps));
    const raw = await fake.rawDatabase();

    await expect(raw.run('INSERT INTO journey (id, start_at) VALUES (2, 0)')).rejects.toThrow();
    await raw.close();
  });

  it('keep an existing journey when upgrading from version 1', async () => {
    const fake = createFakeStorage();
    const before = unwrap(await openStorage(fake.deps, [initial]));
    await before.close();
    await seedJourney(fake, journeyOf(Date.UTC(2026, 0, 1)));

    const after = unwrap(await openStorage(fake.deps));
    expect(await after.journey.load()).toEqual(ok(journeyOf(Date.UTC(2026, 0, 1))));
    expect(await after.onboarding.loadDraft()).toEqual(ok(EMPTY_DRAFT));
    await after.close();
  });

  describe('version 2', () => {
    async function raw() {
      const fake = createFakeStorage();
      unwrap(await openStorage(fake.deps));
      return fake.rawDatabase();
    }

    it.each([
      ['a reason with neither a preset nor a text', 'INSERT INTO reason (position) VALUES (0)'],
      [
        'a reason with both a preset and a text',
        "INSERT INTO reason (position, preset_id, custom_text) VALUES (0, 'sleep', 'x')",
      ],
      ['a plan without an action', "INSERT INTO plan (position, trigger_id) VALUES (0, 'urge')"],
      [
        'a plan with two actions',
        `INSERT INTO plan (position, trigger_id, action_preset_id, action_custom_text)
         VALUES (0, 'urge', 'guided-breathing', 'x')`,
      ],
      [
        'a second draft',
        "INSERT INTO onboarding_draft (id, step, answers) VALUES (2, 'welcome', '{}')",
      ],
    ])('refuse %s', async (_, sql) => {
      const db = await raw();
      await expect(db.run(sql)).rejects.toThrow();
      await db.close();
    });

    it('refuse the same preset reason twice, but allow several custom ones', async () => {
      const db = await raw();
      await db.run("INSERT INTO reason (position, preset_id) VALUES (0, 'sleep')");
      await expect(
        db.run("INSERT INTO reason (position, preset_id) VALUES (1, 'sleep')"),
      ).rejects.toThrow();
      await db.run("INSERT INTO reason (position, custom_text) VALUES (1, 'a')");
      await db.run("INSERT INTO reason (position, custom_text) VALUES (2, 'b')");
      await db.close();
    });
  });

  describe('version 3', () => {
    async function raw() {
      const fake = createFakeStorage();
      unwrap(await openStorage(fake.deps));
      return fake.rawDatabase();
    }

    it('keeps the lapses of version 2, with no time of logging', async () => {
      const fake = createFakeStorage();
      const before = unwrap(await openStorage(fake.deps, [initial, onboarding]));
      await before.close();
      await seedJourney(fake, journeyOf(Date.UTC(2026, 0, 1), [Date.UTC(2026, 0, 2)]));

      const after = unwrap(await openStorage(fake.deps));
      expect(await after.journey.load()).toEqual(
        ok(journeyOf(Date.UTC(2026, 0, 1), [Date.UTC(2026, 0, 2)])),
      );
      expect(await after.lapses.latest()).toEqual(
        ok({ id: 1, at: Date.UTC(2026, 0, 2), recordedAt: null }),
      );
      await after.close();
    });

    it.each([
      [
        'a previous plan without a new one',
        "INSERT INTO lapse_detail (lapse_id, context, previous_plan) VALUES (1, '[]', '{}')",
      ],
      ['a detail without a context', 'INSERT INTO lapse_detail (lapse_id) VALUES (1)'],
      ['an urge without a start', 'INSERT INTO urge_event (ended_at) VALUES (NULL)'],
      [
        'an unknown outcome',
        "INSERT INTO urge_event (started_at, ended_at, outcome) VALUES (0, 1, 'relapse')",
      ],
      [
        'an outcome without an end',
        "INSERT INTO urge_event (started_at, outcome) VALUES (0, 'held')",
      ],
      ['an end without an outcome', 'INSERT INTO urge_event (started_at, ended_at) VALUES (0, 1)'],
    ])('refuse %s', async (_, sql) => {
      const db = await raw();
      await expect(db.run(sql)).rejects.toThrow();
      await db.close();
    });
  });

  describe('version 4', () => {
    async function raw() {
      const fake = createFakeStorage();
      unwrap(await openStorage(fake.deps));
      return fake.rawDatabase();
    }

    const insert = `INSERT INTO check_in
      (local_day, recorded_at, updated_at, mood, urge_level, context) VALUES`;

    it('keeps the lapses and urges of version 3', async () => {
      const fake = createFakeStorage();
      const before = unwrap(await openStorage(fake.deps, [initial, onboarding, lapsesAndUrges]));
      await before.close();
      await seedJourney(fake, journeyOf(Date.UTC(2026, 0, 1)));
      const seeded = unwrap(await openStorage(fake.deps, [initial, onboarding, lapsesAndUrges]));
      unwrap(
        await seeded.lapses.record({
          at: Date.UTC(2026, 0, 2),
          recordedAt: Date.UTC(2026, 0, 2),
          details: null,
          plan: null,
        }),
      );
      await seeded.close();

      const after = unwrap(await openStorage(fake.deps));
      expect(await after.journey.load()).toEqual(
        ok(journeyOf(Date.UTC(2026, 0, 1), [Date.UTC(2026, 0, 2)])),
      );
      expect(await after.checkIns.since(0)).toEqual(ok([]));
      await after.close();
    });

    it.each([
      ['a mood of 0', `${insert} (1, 0, 0, 0, 'none', '[]')`],
      ['a mood of 6', `${insert} (1, 0, 0, 6, 'none', '[]')`],
      ['an unknown urge level', `${insert} (1, 0, 0, 3, 'extreme', '[]')`],
      [
        'a check-in without a context',
        "INSERT INTO check_in (local_day, recorded_at, updated_at, mood, urge_level) VALUES (1, 0, 0, 3, 'none')",
      ],
      ['a mood stored as text', `${insert} (1, 0, 0, 'three', 'none', '[]')`],
    ])('refuse %s', async (_, sql) => {
      const db = await raw();
      await expect(db.run(sql)).rejects.toThrow();
      await db.close();
    });

    it('refuse two check-ins on the same day', async () => {
      const db = await raw();
      await db.run(`${insert} (1, 0, 0, 3, 'none', '[]')`);
      await expect(db.run(`${insert} (1, 5, 5, 4, 'none', '[]')`)).rejects.toThrow();
      await db.close();
    });
  });

  describe('version 5', () => {
    async function raw() {
      const fake = createFakeStorage();
      unwrap(await openStorage(fake.deps));
      return fake.rawDatabase();
    }

    const insert = `INSERT INTO journal_note
      (local_day, created_at, utc_offset, updated_at, title, body) VALUES`;

    it('keeps the check-ins of version 4', async () => {
      const fake = createFakeStorage();
      const versions = [initial, onboarding, lapsesAndUrges, checkIns];
      const before = unwrap(await openStorage(fake.deps, versions));
      await before.close();
      await seedJourney(fake, journeyOf(Date.UTC(2026, 0, 1)));
      const seeded = unwrap(await openStorage(fake.deps, versions));
      const checkIn = unwrap(
        await seeded.checkIns.save(20_000, Date.UTC(2026, 0, 2), {
          mood: 3,
          urge: 'none',
          context: [],
          note: null,
        }),
      );
      await seeded.close();

      const after = unwrap(await openStorage(fake.deps));
      expect(await after.checkIns.since(0)).toEqual(ok([checkIn]));
      expect(await after.journal.list()).toEqual(ok([]));
      await after.close();
    });

    it.each([
      ['an empty title', `${insert} (1, 0, 0, 0, '', 'Text')`],
      ['an empty text', `${insert} (1, 0, 0, 0, NULL, '')`],
      ['a note without text', `${insert} (1, 0, 0, 0, NULL, NULL)`],
      ['an offset beyond 18 hours', `${insert} (1, 0, 1081, 0, NULL, 'Text')`],
      ['a note without an offset', `${insert} (1, 0, NULL, 0, NULL, 'Text')`],
      ['a day stored as text', `${insert} ('one', 0, 0, 0, NULL, 'Text')`],
    ])('refuse %s', async (_, sql) => {
      const db = await raw();
      await expect(db.run(sql)).rejects.toThrow();
      await db.close();
    });
  });
});
