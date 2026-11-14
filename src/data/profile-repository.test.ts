import { openStorage } from '@/data/open-storage';
import { parseCustomText } from '@/domain/custom-text';
import type { OnboardingResult } from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const MINE = unwrap(parseCustomText('Be free'));
const CALL = unwrap(parseCustomText('Call Sam'));

const ANSWERS: OnboardingResult = {
  journey: journeyOf(Date.UTC(2026, 0, 1)),
  reasons: [
    { kind: 'preset', id: 'sleep' },
    { kind: 'preset', id: 'focus' },
    { kind: 'custom', text: MINE },
  ],
  riskMoments: ['stress', 'weekend'],
  plans: [
    { trigger: 'stress', action: { kind: 'custom', text: CALL } },
    { trigger: 'urge', action: { kind: 'preset', id: 'guided-breathing' } },
  ],
};

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('profile repository', () => {
  it('is empty before the onboarding', async () => {
    const { storage } = await setUp();
    expect(await storage.profile.load()).toEqual(ok({ reasons: [], riskMoments: [], plans: [] }));
  });

  it('reads back the answers of the onboarding, in order', async () => {
    const { storage } = await setUp();
    unwrap(await storage.onboarding.complete(ANSWERS));

    expect(await storage.profile.load()).toEqual(
      ok({ reasons: ANSWERS.reasons, riskMoments: ANSWERS.riskMoments, plans: ANSWERS.plans }),
    );
  });

  it('leaves out rows that cannot be read and keeps the others', async () => {
    const { storage, rawDatabase } = await setUp();
    unwrap(await storage.onboarding.complete(ANSWERS));
    const raw = await rawDatabase();
    await raw.exec(`
      INSERT INTO reason (position, preset_id) VALUES (9, 'unknown');
      INSERT INTO reason (position, custom_text) VALUES (10, '   ');
      INSERT INTO risk_moment (preset_id, position) VALUES ('unknown', 9);
      INSERT INTO plan (position, trigger_id, action_preset_id) VALUES (-2, 'unknown', 'guided-breathing');
      INSERT INTO plan (position, trigger_id, action_preset_id) VALUES (-1, 'urge', 'unknown');
    `);
    await raw.close();

    expect(await storage.profile.load()).toEqual(
      ok({ reasons: ANSWERS.reasons, riskMoments: ANSWERS.riskMoments, plans: ANSWERS.plans }),
    );
  });

  it('reports storage errors', async () => {
    const { storage } = await setUp();
    await storage.close();
    expect(await storage.profile.load()).toEqual(err('storage-failed'));
  });
});
