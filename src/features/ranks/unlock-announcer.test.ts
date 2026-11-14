import { openStorage } from '@/data/open-storage';
import { pendingUnlock, withUnlocked, type RankId } from '@/domain/ranks';
import { err, ok } from '@/domain/result';
import { MS_PER_DAY } from '@/domain/time';
import { createUnlockAnnouncer } from '@/features/ranks/unlock-announcer';
import { loadSession } from '@/features/session/load-session';
import { journeyOf, unwrap } from '@test/arbitraries';
import { createFakeStorage } from '@test/fakes/fake-storage';
import { seedJourney } from '@test/seed';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

function setUp(persistResult: Promise<unknown> = Promise.resolve(ok(undefined))) {
  const events: string[] = [];
  let session: RankId[] = [];
  const persist = jest.fn((ids: readonly RankId[]) => {
    events.push(`persist ${ids.join(',')}`);
    return persistResult;
  });
  const announcer = createUnlockAnnouncer({
    persist,
    addToSession: (ids) => {
      events.push(`session ${ids.join(',')}`);
      session = withUnlocked(session, ids);
    },
  });
  return { announcer, persist, events, session: () => session };
}

describe('createUnlockAnnouncer', () => {
  it('adds the ranks to the session and stores them', () => {
    const { announcer, events, session } = setUp();
    expect(announcer.announce(['novice', 'apprentice'])).toBe(true);
    expect(events).toEqual(['session novice,apprentice', 'persist novice,apprentice']);
    expect(session()).toEqual(['novice', 'apprentice']);
  });

  it('announces once when asked twice before the write finishes', () => {
    const { announcer, persist } = setUp(new Promise(() => {}));
    expect(announcer.announce(['novice'])).toBe(true);
    expect(announcer.announce(['novice'])).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('announces a higher rank reached later', () => {
    const { announcer } = setUp();
    announcer.announce(['novice']);
    expect(announcer.announce(['apprentice'])).toBe(true);
  });

  it('does not announce again in the same run when the write failed', async () => {
    const { announcer, session } = setUp(Promise.resolve(err('storage-failed')));
    expect(announcer.announce(['novice'])).toBe(true);
    await Promise.resolve();
    expect(announcer.announce(['novice'])).toBe(false);
    expect(session()).toEqual(['novice']);
  });

  it('leaves nothing to announce after a relaunch once the ranks are stored', async () => {
    const start = Date.UTC(2026, 0, 1);
    const now = start + 20 * MS_PER_DAY;
    const fake = createFakeStorage();
    const storage = unwrap(await openStorage(fake.deps));
    await seedJourney(fake, journeyOf(start));

    const pending = pendingUnlock(journeyOf(start), [], now);
    const ids = pending ? [...pending.unlock.others, pending.unlock.highest].map((r) => r.id) : [];
    const announcer = createUnlockAnnouncer({
      persist: (unlocked) => storage.ranks.unlock(unlocked),
      addToSession: () => {},
    });
    announcer.announce(ids);
    await storage.close();

    const reopened = unwrap(await openStorage(fake.deps));
    const session = unwrap(await loadSession(reopened));
    expect(session.unlockedRanks).toEqual(['novice', 'apprentice', 'initiate', 'watcher']);
    expect(pendingUnlock(journeyOf(start), session.unlockedRanks, now)).toBeNull();
  });
});
