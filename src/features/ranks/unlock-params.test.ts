import { fromUnlockParams, toUnlockParams } from '@/features/ranks/unlock-params';

describe('unlock route parameters', () => {
  it('round-trips the unlocked ranks and the total', () => {
    const data = fromUnlockParams(toUnlockParams(['novice', 'apprentice', 'initiate'], 9));
    expect(data?.unlock.highest.id).toBe('initiate');
    expect(data?.unlock.others.map((rank) => rank.id)).toEqual(['novice', 'apprentice']);
    expect(data?.totalCleanDays).toBe(9);
  });

  it.each([
    [{}],
    [{ ranks: 'novice' }],
    [{ ranks: 'novice', days: '-1' }],
    [{ ranks: 'novice', days: '1.5' }],
    [{ ranks: 'novice', days: '' }],
    [{ ranks: 'emperor', days: '1' }],
    [{ ranks: '', days: '1' }],
    [{ ranks: ['novice'], days: '1' }],
  ])('refuses malformed parameters: %p', (params) => {
    expect(fromUnlockParams(params)).toBeNull();
  });
});
