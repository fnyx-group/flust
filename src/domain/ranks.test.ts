import * as fc from 'fast-check';

import {
  isRankId,
  pendingUnlock,
  rankGrid,
  rankProgress,
  RANKS,
  rankStanding,
  unlockFromIds,
  withUnlocked,
  type RankId,
} from '@/domain/ranks';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/domain/time';
import { journeyFrom, journeyInput, journeyOf, rankIds, totalDays } from '@test/arbitraries';

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
  const start = Date.UTC(2026, 0, 1, 8);
  const sevenHoursForty = 7 * MS_PER_HOUR + 40 * MS_PER_MINUTE;

  it('measures the first day in time before any rank', () => {
    expect(rankStanding(journeyOf(start), [], start + sevenHoursForty)).toEqual({
      status: 'pending',
      first: RANKS[0],
      fraction: sevenHoursForty / MS_PER_DAY,
      msLeft: MS_PER_DAY - sevenHoursForty,
    });
  });

  it('never shows more than a day left when the clock is behind the streak start', () => {
    expect(rankStanding(journeyOf(start), [], start - MS_PER_HOUR)).toMatchObject({
      status: 'pending',
      fraction: 0,
      msLeft: MS_PER_DAY,
    });
  });

  it('measures total clean days against the next threshold', () => {
    expect(rankStanding(journeyOf(start), [], start + 47.5 * MS_PER_DAY)).toEqual({
      status: 'ranked',
      current: expect.objectContaining({ id: 'sorcerer' }),
      next: expect.objectContaining({ id: 'white-mage' }),
      totalCleanDays: 47,
      fraction: 47 / 60,
    });
  });

  // The example of docs/product/ranks.md: a lapse backdated to day 3.7, seen at day 7.5.
  it('keeps a rank whose threshold a backdated lapse took the total below', () => {
    const journey = journeyOf(start, [start + 3.7 * MS_PER_DAY]);
    const standing = rankStanding(journey, idsUpTo('initiate'), start + 7.5 * MS_PER_DAY);
    expect(standing).toMatchObject({
      status: 'ranked',
      current: { id: 'initiate' },
      next: { id: 'watcher' },
      totalCleanDays: 6,
      fraction: 6 / 14,
    });
  });

  it('is full once every rank is unlocked', () => {
    expect(rankStanding(journeyOf(start), [], start + 400 * MS_PER_DAY)).toMatchObject({
      current: { id: 'free-soul' },
      next: null,
      fraction: 1,
    });
  });

  it('keeps the fraction between 0 and 1 and the time left within a day', () => {
    fc.assert(
      fc.property(
        journeyInput,
        rankIds,
        fc.integer({ min: -2 * MS_PER_DAY, max: 2 * MS_PER_DAY }),
        (input, ids, shift) => {
          const standing = rankStanding(journeyFrom(input), ids, input.now + shift);
          const timeLeftValid =
            standing.status === 'ranked' || (standing.msLeft >= 0 && standing.msLeft <= MS_PER_DAY);
          return standing.fraction >= 0 && standing.fraction <= 1 && timeLeftValid;
        },
      ),
    );
  });
});

function gridStates(stored: readonly RankId[], total: number) {
  return rankGrid(rankProgress(stored, total)).map((cell) => cell.state);
}

describe('rankGrid', () => {
  it('shows the first rank as next before the first clean day', () => {
    const grid = rankGrid(rankProgress([], 0));
    expect(grid.map((cell) => cell.state)).toEqual(['next', ...Array(11).fill('locked')]);
    expect(grid[0]?.nameVisible).toBe(true);
    expect(grid.slice(1).every((cell) => !cell.nameVisible)).toBe(true);
  });

  it('marks unlocked, current, next and locked ranks', () => {
    expect(gridStates(idsUpTo('sorcerer'), 47)).toEqual([
      'unlocked',
      'unlocked',
      'unlocked',
      'unlocked',
      'unlocked',
      'current',
      'next',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
  });

  it('counts a rank the total reached before it is stored, like the home badge', () => {
    expect(gridStates([], 7).slice(0, 4)).toEqual(['unlocked', 'unlocked', 'current', 'next']);
  });

  it('keeps stored ranks unlocked when a backdated lapse lowers the total', () => {
    expect(gridStates(idsUpTo('initiate'), 6).slice(0, 4)).toEqual([
      'unlocked',
      'unlocked',
      'current',
      'next',
    ]);
  });

  it('shows every name and no next rank once all ranks are unlocked', () => {
    const grid = rankGrid(rankProgress([], 365));
    expect(grid.at(-1)?.state).toBe('current');
    expect(grid.every((cell) => cell.nameVisible && cell.state !== 'next')).toBe(true);
  });

  it('hides exactly the names after the next rank, and agrees with the badge', () => {
    fc.assert(
      fc.property(rankIds, totalDays, (stored, total) => {
        const progress = rankProgress(stored, total);
        const grid = rankGrid(progress);
        const current = grid.filter((cell) => cell.state === 'current');
        const next = grid.findIndex((cell) => cell.state === 'next');
        expect(current.length).toBeLessThanOrEqual(1);
        expect(current[0]?.rank).toBe(progress.current ?? undefined);
        expect(next === -1 ? null : grid[next]?.rank).toBe(progress.next?.rank ?? null);
        grid.forEach((cell, index) => {
          expect(cell.nameVisible).toBe(next === -1 || index <= next);
        });
      }),
    );
  });
});

describe('pendingUnlock', () => {
  const start = Date.UTC(2026, 0, 1);

  it('has nothing to announce before the first clean day', () => {
    expect(pendingUnlock(journeyOf(start), [], start + MS_PER_DAY - 1)).toBeNull();
  });

  it('announces the first rank once a full day is clean', () => {
    const pending = pendingUnlock(journeyOf(start), [], start + MS_PER_DAY);
    expect(pending?.unlock.highest.id).toBe('novice');
    expect(pending?.unlock.others).toEqual([]);
    expect(pending?.totalCleanDays).toBe(1);
  });

  it('announces every rank crossed while the app was closed, highest first', () => {
    const pending = pendingUnlock(journeyOf(start), ['novice'], start + 75.5 * MS_PER_DAY);
    expect(pending?.unlock.highest.id).toBe('white-mage');
    expect(pending?.unlock.others.map((rank) => rank.id)).toEqual([
      'apprentice',
      'initiate',
      'watcher',
      'black-mage',
      'sorcerer',
    ]);
    expect(pending?.totalCleanDays).toBe(75);
  });

  it('has nothing left to announce once the announced ranks are stored', () => {
    fc.assert(
      fc.property(journeyInput, rankIds, (input, stored) => {
        const journey = journeyFrom(input);
        const pending = pendingUnlock(journey, stored, input.now);
        const announced = pending
          ? [...pending.unlock.others, pending.unlock.highest].map((rank) => rank.id)
          : [];
        expect(pendingUnlock(journey, withUnlocked(stored, announced), input.now)).toBeNull();
      }),
    );
  });
});

describe('unlockFromIds', () => {
  it('shows the highest rank and lists the others in rank order, whatever the input order', () => {
    const unlock = unlockFromIds(['watcher', 'novice', 'initiate']);
    expect(unlock?.highest.id).toBe('watcher');
    expect(unlock?.others.map((rank) => rank.id)).toEqual(['novice', 'initiate']);
  });

  it('refuses an empty list', () => {
    expect(unlockFromIds([])).toBeNull();
  });

  it('refuses a list with an unknown id', () => {
    expect(unlockFromIds(['novice', 'emperor'])).toBeNull();
  });
});

describe('withUnlocked', () => {
  it('merges without duplicates, in rank order', () => {
    expect(withUnlocked(['initiate', 'novice'], ['apprentice', 'novice'])).toEqual([
      'novice',
      'apprentice',
      'initiate',
    ]);
  });

  it('contains exactly the stored and added ranks', () => {
    const ids = fc.subarray(RANKS.map((rank) => rank.id));
    fc.assert(
      fc.property(ids, ids, (stored, added) => {
        const merged = withUnlocked(stored, added);
        expect(new Set(merged)).toEqual(new Set([...stored, ...added]));
        expect(merged).toHaveLength(new Set(merged).size);
      }),
    );
  });
});
