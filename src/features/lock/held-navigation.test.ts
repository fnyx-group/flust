import { hold, isLocked, onReleased, setLocked, takeHeld } from '@/features/lock/held-navigation';

afterEach(() => {
  setLocked(false);
  takeHeld();
});

describe('held navigation', () => {
  it('holds a tap that arrives while locked, and releases it on unlock', () => {
    const released = jest.fn();
    const stop = onReleased(released);
    setLocked(true);
    expect(isLocked()).toBe(true);

    hold('/check-in');
    expect(released).not.toHaveBeenCalled();
    setLocked(false);

    expect(released).toHaveBeenCalledTimes(1);
    expect(takeHeld()).toBe('/check-in');
    expect(takeHeld()).toBeNull();
    stop();
  });

  it('keeps only the latest request', () => {
    setLocked(true);
    hold('/');
    hold('/check-in');
    setLocked(false);
    expect(takeHeld()).toBe('/check-in');
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
