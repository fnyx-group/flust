import * as fc from 'fast-check';

import { isRankId, rankProgress, RANKS, rankStanding, type RankId } from '@/domain/ranks';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { rankIds, totalDays } from '@test/arbitraries';

function idsUpTo(id: RankId): RankId[] {
  const index = RANKS.findIndex((rank) => rank.id === id);
  return RANKS.slice(0, index + 1).map((rank) => rank.id);
}

describe('RANKS', () => {
  it('follows the thresholds of the product spec in ascending order', () => {
    expect(RANKS.map((rank) => [rank.id, rank.threshold])).toEqual([
      ['novice', 1],
      ['apprentice', 3],
      ['initiate', 7],
      ['watcher', 14],
      ['black-mage', 30],
      ['sorcerer', 45],
      ['white-mage', 60],
      ['silver-mage', 90],
      ['archmage', 120],
      ['sovereign', 180],
      ['scarlet-mage', 270],
      ['free-soul', 365],
    ]);
  });

  it('numbers ranks within each of the five circles', () => {
    expect(RANKS.map((rank) => `${rank.circle}.${rank.tier}`)).toEqual([
      '1.1',
      '1.2',
      '1.3',
      '2.1',
      '2.2',
      '2.3',
      '3.1',
      '3.2',
      '3.3',
      '4.1',
      '4.2',
      '5.1',
    ]);
  });
});

describe('isRankId', () => {
  it('recognizes known ids only', () => {
    expect(isRankId('archmage')).toBe(true);
    expect(isRankId('emperor')).toBe(false);
  });

  it.each([null, undefined, 3, {}])('refuses a value that is not a string: %p', (value) => {
    expect(isRankId(value)).toBe(false);
  });
});

describe('rankProgress', () => {
  it('has no rank before the first clean day', () => {
    expect(rankProgress([], 0)).toEqual({
      current: null,
      unlocked: [],
      unlock: null,
      next: { rank: RANKS[0], daysLeft: 1 },
    });
  });

  it.each([
    [1, 'novice', 'apprentice', 2],
    [2, 'novice', 'apprentice', 1],
    [3, 'apprentice', 'initiate', 4],
    [6, 'apprentice', 'initiate', 1],
    [7, 'initiate', 'watcher', 7],
    [13, 'initiate', 'watcher', 1],
    [14, 'watcher', 'black-mage', 16],
    [29, 'watcher', 'black-mage', 1],
    [30, 'black-mage', 'sorcerer', 15],
    [45, 'sorcerer', 'white-mage', 15],
    [60, 'white-mage', 'silver-mage', 30],
    [90, 'silver-mage', 'archmage', 30],
    [120, 'archmage', 'sovereign', 60],
    [180, 'sovereign', 'scarlet-mage', 90],
    [270, 'scarlet-mage', 'free-soul', 95],
    [364, 'scarlet-mage', 'free-soul', 1],
  ])('at %p days the rank is %p, next %p in %p days', (total, current, next, daysLeft) => {
    const progress = rankProgress([], total);
    expect(progress.current?.id).toBe(current);
    expect(progress.next?.rank.id).toBe(next);
    expect(progress.next?.daysLeft).toBe(daysLeft);
  });

  it.each([365, 1000])('has no next rank after Free soul at %p days', (total) => {
    const progress = rankProgress([], total);
    expect(progress.current?.id).toBe('free-soul');
    expect(progress.next).toBeNull();
  });

  it('shows the highest of several ranks unlocked while the app was closed', () => {
    const progress = rankProgress(['novice'], 20);
    expect(progress.unlock?.highest.id).toBe('watcher');
    expect(progress.unlock?.others.map((rank) => rank.id)).toEqual(['apprentice', 'initiate']);
    expect(progress.unlocked).toEqual(idsUpTo('watcher'));
  });

  it('keeps a rank when a backdated lapse lowers the total', () => {
    const progress = rankProgress(idsUpTo('initiate'), 6);
    expect(progress.current?.id).toBe('initiate');
    expect(progress.unlock).toBeNull();
    expect(progress.next).toEqual({ rank: RANKS[3], daysLeft: 8 });
  });

  it('fills gaps in corrupted data up to the highest unlocked rank, without announcing them', () => {
    const progress = rankProgress(['novice', 'watcher'], 0);
    expect(progress.unlocked).toEqual(idsUpTo('watcher'));
    expect(progress.current?.id).toBe('watcher');
    expect(progress.unlock).toBeNull();
    expect(progress.next).toEqual({ rank: RANKS[4], daysLeft: 30 });
  });

  it('never loses an unlocked rank', () => {
    fc.assert(
      fc.property(rankIds, totalDays, (previous, total) => {
        expect(rankProgress(previous, total).unlocked).toEqual(expect.arrayContaining(previous));
      }),
    );
  });

  it('never moves back over any sequence of totals, including lower ones', () => {
    fc.assert(
      fc.property(fc.array(totalDays, { maxLength: 20 }), (totals) => {
        let unlocked: readonly RankId[] = [];
        let currentThreshold = 0;
        for (const total of totals) {
          const progress = rankProgress(unlocked, total);
          expect(progress.unlocked).toEqual(expect.arrayContaining([...unlocked]));
          expect(progress.current?.threshold ?? 0).toBeGreaterThanOrEqual(currentThreshold);
          unlocked = progress.unlocked;
          currentThreshold = progress.current?.threshold ?? 0;
        }
      }),
    );
  });

  it('unlocks every rank the total reaches, and announces only new ones', () => {
    fc.assert(
      fc.property(rankIds, totalDays, (previous, total) => {
        const progress = rankProgress(previous, total);
        const reached = RANKS.filter((rank) => rank.threshold <= total).map((rank) => rank.id);
        expect(progress.unlocked).toEqual(expect.arrayContaining(reached));

        const announced = progress.unlock
          ? [...progress.unlock.others, progress.unlock.highest].map((rank) => rank.id)
          : [];
        expect(announced).toEqual(progress.unlocked.filter((id) => !previous.includes(id)));
        expect(progress.current?.id).toBe(progress.unlocked.at(-1));
      }),
    );
  });

  it('announces nothing when the same total is checked again', () => {
    fc.assert(
      fc.property(rankIds, totalDays, (previous, total) => {
        const first = rankProgress(previous, total);
        expect(rankProgress(first.unlocked, total).unlock).toBeNull();
      }),
    );
  });

  it('always points to a reachable next rank', () => {
    fc.assert(
      fc.property(rankIds, totalDays, (previous, total) => {
        const progress = rankProgress(previous, total);
        if (progress.next === null) {
          expect(progress.current?.id).toBe('free-soul');
          return;
        }
        expect(progress.next.daysLeft).toBeGreaterThanOrEqual(1);
        expect(progress.next.daysLeft).toBe(progress.next.rank.threshold - total);
        expect(progress.next.rank.threshold).toBeGreaterThan(progress.current?.threshold ?? 0);
      }),
    );
  });
});

describe('rankStanding', () => {
  const sevenHoursForty = 7 * MS_PER_HOUR + 40 * MS_PER_MINUTE;

  it('measures the first day in time before any rank', () => {
    const standing = rankStanding(rankProgress([], 0), 0, sevenHoursForty);
    expect(standing).toEqual({
      status: 'pending',
      first: RANKS[0],
      fraction: sevenHoursForty / MS_PER_DAY,
      msLeft: MS_PER_DAY - sevenHoursForty,
    });
  });

  it('measures total clean days against the next threshold', () => {
    expect(rankStanding(rankProgress([], 47), 47, 12 * MS_PER_DAY)).toEqual({
      status: 'ranked',
      current: expect.objectContaining({ id: 'sorcerer' }),
      next: expect.objectContaining({ id: 'white-mage' }),
      totalCleanDays: 47,
      fraction: 47 / 60,
    });
  });

  it('keeps a rank whose threshold a backdated lapse took the total below', () => {
    const standing = rankStanding(rankProgress(idsUpTo('initiate'), 6), 6, MS_PER_DAY);
    expect(standing).toMatchObject({
      status: 'ranked',
      current: { id: 'initiate' },
      next: { id: 'watcher' },
      fraction: 6 / 14,
    });
  });

  it('is full once every rank is unlocked', () => {
    expect(rankStanding(rankProgress([], 400), 400, 0)).toMatchObject({
      current: { id: 'free-soul' },
      next: null,
      fraction: 1,
    });
  });

  it('keeps the fraction between 0 and 1', () => {
    fc.assert(
      fc.property(
        rankIds,
        totalDays,
        fc.integer({ min: -MS_PER_DAY, max: 2 * MS_PER_DAY }),
        (ids, total, streakMs) => {
          const { fraction } = rankStanding(rankProgress(ids, total), total, streakMs);
          return fraction >= 0 && fraction <= 1;
        },
      ),
    );
  });
});
