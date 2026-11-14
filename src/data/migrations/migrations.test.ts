import { MIGRATIONS } from '@/data/migrations';
import { initial } from '@/data/migrations/0001-initial';
import { openStorage } from '@/data/open-storage';
import { DATABASE_NAME } from '@/data/storage-deps';
import { EMPTY_DRAFT } from '@/domain/onboarding';
import { ok } from '@/domain/result';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

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
      'onboarding_draft',
      'plan',
      'reason',
      'risk_moment',
      'setting',
      'unlocked_rank',
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
    unwrap(await before.journey.save(journeyOf(Date.UTC(2026, 0, 1))));
    await before.close();

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
});
