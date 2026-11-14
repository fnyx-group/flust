import { EMPTY_DRAFT, type OnboardingDraft } from '@/domain/onboarding';
import { createDraftSaver, TYPING_SAVE_DELAY_MS } from '@/features/onboarding/draft-saver';

const reasons: OnboardingDraft = { ...EMPTY_DRAFT, step: 'reasons' };
const plan: OnboardingDraft = { ...EMPTY_DRAFT, step: 'plan' };

describe('createDraftSaver', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves a tap at once', () => {
    const save = jest.fn();
    createDraftSaver(save).saveNow(reasons);
    expect(save).toHaveBeenCalledWith(reasons);
  });

  it('saves typing once, with the last text, when it pauses', () => {
    const save = jest.fn();
    const saver = createDraftSaver(save);
    saver.saveSoon(reasons);
    jest.advanceTimersByTime(TYPING_SAVE_DELAY_MS - 1);
    saver.saveSoon(plan);
    jest.advanceTimersByTime(TYPING_SAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(plan);
  });

  it('saves pending typing when flushed, and only once', () => {
    const save = jest.fn();
    const saver = createDraftSaver(save);
    saver.saveSoon(reasons);
    saver.flush();
    jest.runAllTimers();
    saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(reasons);
  });

  it('lets a tap replace pending typing', () => {
    const save = jest.fn();
    const saver = createDraftSaver(save);
    saver.saveSoon(reasons);
    saver.saveNow(plan);
    jest.runAllTimers();
    expect(save.mock.calls).toEqual([[plan]]);
  });
});
