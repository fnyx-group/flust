import { MIGRATIONS } from '@/data/migrations';
import { initial } from '@/data/migrations/0001-initial';
import { onboarding } from '@/data/migrations/0002-onboarding';
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
});
