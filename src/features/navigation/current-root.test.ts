import { isCurrentRoot, registerRoot } from '@/features/navigation/current-root';

describe('the current root', () => {
  it('is the root mounted last, even while an older one is still mounted', () => {
    const old = {};
    const recreated = {};
    const unmountOld = registerRoot(old);
    const unmountRecreated = registerRoot(recreated);

    expect(isCurrentRoot(old)).toBe(false);
    expect(isCurrentRoot(recreated)).toBe(true);

    unmountOld();
    expect(isCurrentRoot(recreated)).toBe(true);
    unmountRecreated();
  });

  it('goes back to the older root when the newer one unmounts first', () => {
    const old = {};
    const unmountOld = registerRoot(old);
    const unmountNewer = registerRoot({});

    unmountNewer();
    expect(isCurrentRoot(old)).toBe(true);

    unmountOld();
    expect(isCurrentRoot(old)).toBe(false);
  });
});
