import { handleBackPress } from '@/features/onboarding/back-press';

describe('handleBackPress', () => {
  it('goes to the previous step and keeps the event', () => {
    const onBack = jest.fn();
    expect(handleBackPress(onBack, false)).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the onboarding finishes, and still keeps the event', () => {
    const onBack = jest.fn();
    expect(handleBackPress(onBack, true)).toBe(true);
    expect(onBack).not.toHaveBeenCalled();
  });
});
