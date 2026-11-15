import {
  hold,
  isLocked,
  onReleased,
  redirectLink,
  setLocked,
  takeHeld,
} from '@/features/lock/held-navigation';

afterEach(() => {
  setLocked(false);
  takeHeld();
});

describe('held navigation', () => {
  it('lets links through while unlocked', () => {
    expect(redirectLink('/check-in', false)).toBe('/check-in');
    expect(takeHeld()).toBeNull();
  });

  it('holds a link that arrives while locked, and releases it on unlock', () => {
    const released = jest.fn();
    const stop = onReleased(released);
    setLocked(true);
    expect(isLocked()).toBe(true);

    expect(redirectLink('/ranks', false)).toBeNull();
    expect(released).not.toHaveBeenCalled();
    setLocked(false);

    expect(released).toHaveBeenCalledTimes(1);
    expect(takeHeld()).toEqual({ kind: 'link', url: '/ranks' });
    expect(takeHeld()).toBeNull();
    stop();
  });

  it('lets a launch link through, since no screen mounts before the first unlock', () => {
    setLocked(true);
    expect(redirectLink('/check-in', true)).toBe('/check-in');
  });

  it('keeps only the latest request', () => {
    setLocked(true);
    redirectLink('/ranks', false);
    hold({ kind: 'route', route: '/check-in' });
    setLocked(false);
    expect(takeHeld()).toEqual({ kind: 'route', route: '/check-in' });
  });

  it('tells no one on unlock when nothing is held', () => {
    const released = jest.fn();
    const stop = onReleased(released);
    setLocked(true);
    setLocked(false);
    expect(released).not.toHaveBeenCalled();
    stop();
  });
});
