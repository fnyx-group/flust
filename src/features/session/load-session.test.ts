import { openStorage } from '@/data/open-storage';
import { EMPTY_DRAFT, type OnboardingDraft } from '@/domain/onboarding';
import { err, ok } from '@/domain/result';
import { loadSession } from '@/features/session/load-session';
import { i18n } from '@/lib/i18n';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';

const START = Date.UTC(2026, 0, 1);
const initialLanguage = i18n.language;

async function setUp() {
  const fake = createFakeStorage();
  const storage = unwrap(await openStorage(fake.deps));
  return { ...fake, storage };
}

describe('loadSession', () => {
  afterEach(async () => {
    await i18n.changeLanguage(initialLanguage);
  });

  it('loads the journey and applies the chosen language', async () => {
    const { storage } = await setUp();
    unwrap(await storage.journey.save(journeyOf(START)));
    unwrap(await storage.settings.saveLanguage('fr'));

    expect(await loadSession(storage)).toEqual(
      ok({ journey: journeyOf(START), draft: EMPTY_DRAFT, unlockedRanks: [] }),
    );
    expect(i18n.language).toBe('fr');
  });

  it('loads the ranks stored as unlocked with the journey', async () => {
    const { storage } = await setUp();
    unwrap(await storage.journey.save(journeyOf(START)));
    unwrap(await storage.ranks.unlock(['novice', 'apprentice']));

    expect(await loadSession(storage)).toEqual(
      ok({
        journey: journeyOf(START),
        draft: EMPTY_DRAFT,
        unlockedRanks: ['novice', 'apprentice'],
      }),
    );
  });

  it('reports unlocked ranks that cannot be read as a storage failure', async () => {
    const { storage, rawDatabase } = await setUp();
    unwrap(await storage.journey.save(journeyOf(START)));
    const raw = await rawDatabase();
    await raw.exec('DROP TABLE unlocked_rank');
    await raw.close();

    expect(await loadSession(storage)).toEqual(err('storage-failed'));
  });

  it('keeps the device language when the stored one is unknown', async () => {
    const { storage } = await setUp();
    unwrap(await storage.settings.saveLanguage('de'));

    unwrap(await loadSession(storage));
    expect(i18n.language).toBe(initialLanguage);
  });

  it('starts an empty onboarding when nothing was answered yet', async () => {
    const { storage } = await setUp();
    expect(await loadSession(storage)).toEqual(
      ok({ journey: null, draft: EMPTY_DRAFT, unlockedRanks: [] }),
    );
  });

  it('resumes the onboarding on the step and with the answers it was left at', async () => {
    const { storage } = await setUp();
    const draft: OnboardingDraft = {
      step: 'plan',
      answers: { ...EMPTY_DRAFT.answers, riskMoments: ['stress'] },
    };
    unwrap(await storage.onboarding.saveDraft(draft));

    expect(await loadSession(storage)).toEqual(ok({ journey: null, draft, unlockedRanks: [] }));
  });

  // A corrupted journey used to be reported like a storage failure, which only offered a retry
  // that reads the same data again.
  it('reports a corrupted journey as such, so that a reset is offered', async () => {
    const { storage, rawDatabase } = await setUp();
    unwrap(await storage.journey.save(journeyOf(START)));
    const raw = await rawDatabase();
    await raw.run('INSERT INTO lapse (at) VALUES (?)', [START - 1]);
    await raw.close();

    expect(await loadSession(storage)).toEqual(err('journey-corrupted'));
  });

  it('reports a draft that cannot be read as a storage failure, instead of starting over', async () => {
    const { storage, rawDatabase } = await setUp();
    const raw = await rawDatabase();
    await raw.exec('DROP TABLE onboarding_draft');
    await raw.close();

    expect(await loadSession(storage)).toEqual(err('storage-failed'));
  });

  it('reports a storage failure as temporary', async () => {
    const { storage } = await setUp();
    await storage.close();

    expect(await loadSession(storage)).toEqual(err('storage-failed'));
  });
});
