import { parseCustomText, type CustomText } from '@/domain/custom-text';
import {
  customReason,
  DEFAULT_PLAN,
  effectivePlan,
  EMPTY_DRAFT,
  finishOnboarding,
  isOnboardingStep,
  nextStep,
  ONBOARDING_STEPS,
  opensJournal,
  previousStep,
  QUESTION_STEPS,
  samePlan,
  setCustomReason,
  shownStep,
  stepProgress,
  toggleReason,
  toggleRiskMoment,
  triggerOptions,
  type OnboardingAnswers,
  type OnboardingStep,
} from '@/domain/onboarding';
import { DEFAULT_LOCK_SETTINGS } from '@/domain/lock';
import { DEFAULT_REMINDER_SETTINGS } from '@/domain/reminders';
import { err } from '@/domain/result';
import { MS_PER_DAY } from '@/domain/time';
import { journeyOf, unwrap } from '@test/arbitraries';

const NOW = Date.UTC(2026, 10, 14, 12);
const TODAY = 20_000;

function text(value: string): CustomText {
  return unwrap(parseCustomText(value));
}

function answers(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return { ...EMPTY_DRAFT.answers, ...overrides };
}

describe('steps', () => {
  it('go forward and back in order, and stop at both ends', () => {
    const next = (step: OnboardingStep) => nextStep(step, true);
    const previous = (step: OnboardingStep) => previousStep(step, true);
    expect(ONBOARDING_STEPS.map(next)).toEqual([
      'reasons',
      'risk-moments',
      'plan',
      'filter',
      'start',
      null,
    ]);
    expect(ONBOARDING_STEPS.map(previous)).toEqual([
      null,
      'welcome',
      'reasons',
      'risk-moments',
      'plan',
      'filter',
    ]);
  });

  it('skip the filter step where there is no filter', () => {
    expect(nextStep('plan', false)).toBe('start');
    expect(previousStep('start', false)).toBe('plan');
    expect(nextStep('filter', false)).toBeNull();
    expect(shownStep('filter', false)).toBe('start');
    expect(shownStep('filter', true)).toBe('filter');
  });

  it('show progress on every step but the welcome', () => {
    expect(ONBOARDING_STEPS).toEqual(['welcome', ...QUESTION_STEPS]);
    expect(QUESTION_STEPS.map((step) => stepProgress(step, true))).toEqual([
      { current: 1, total: 5 },
      { current: 2, total: 5 },
      { current: 3, total: 5 },
      { current: 4, total: 5 },
      { current: 5, total: 5 },
    ]);
    expect(stepProgress('start', false)).toEqual({ current: 4, total: 4 });
    expect(stepProgress('plan', false)).toEqual({ current: 3, total: 4 });
  });

  it('recognize only known steps', () => {
    expect(isOnboardingStep('plan')).toBe(true);
    expect(isOnboardingStep('lock')).toBe(false);
    expect(isOnboardingStep(undefined)).toBe(false);
  });

  it('start on the welcome step with nothing chosen, and no protection', () => {
    expect(EMPTY_DRAFT).toEqual({
      step: 'welcome',
      answers: {
        reasons: [],
        riskMoments: [],
        plan: null,
        start: { kind: 'now' },
        protection: { lock: false, checkInReminder: false },
      },
    });
  });
});

describe('reasons', () => {
  it('toggle presets in a stable order, whatever the order they were picked in', () => {
    const picked = toggleReason(toggleReason([], 'sleep'), 'loved-ones');
    expect(picked).toEqual([
      { kind: 'preset', id: 'loved-ones' },
      { kind: 'preset', id: 'sleep' },
    ]);
    expect(toggleReason(picked, 'sleep')).toEqual([{ kind: 'preset', id: 'loved-ones' }]);
  });

  it('keep a single custom reason after the presets', () => {
    const withCustom = setCustomReason(toggleReason([], 'focus'), text('For my kids'));
    const withMore = toggleReason(withCustom, 'energy');
    expect(withMore).toEqual([
      { kind: 'preset', id: 'energy' },
      { kind: 'preset', id: 'focus' },
      { kind: 'custom', text: 'For my kids' },
    ]);
    expect(customReason(withMore)).toBe('For my kids');

    const replaced = setCustomReason(withMore, text('For me'));
    expect(replaced.filter((reason) => reason.kind === 'custom')).toEqual([
      { kind: 'custom', text: 'For me' },
    ]);

    expect(setCustomReason(replaced, null)).toEqual([
      { kind: 'preset', id: 'energy' },
      { kind: 'preset', id: 'focus' },
    ]);
    expect(customReason([])).toBeNull();
  });
});

describe('risk moments', () => {
  it('toggle in a stable order', () => {
    const picked = toggleRiskMoment(toggleRiskMoment([], 'weekend'), 'stress');
    expect(picked).toEqual(['stress', 'weekend']);
    expect(toggleRiskMoment(picked, 'stress')).toEqual(['weekend']);
  });
});

describe('plans', () => {
  it('offer the chosen risk moments, then any urge', () => {
    expect(triggerOptions([])).toEqual(['urge']);
    expect(triggerOptions(['weekend', 'stress'])).toEqual(['stress', 'weekend', 'urge']);
  });

  it('default to breathing on any urge when the plan step is skipped', () => {
    expect(DEFAULT_PLAN).toEqual({
      trigger: 'urge',
      action: { kind: 'preset', id: 'guided-breathing' },
    });
    expect(effectivePlan(answers({ riskMoments: ['stress'] }))).toEqual(DEFAULT_PLAN);
  });

  it('keep a plan whose risk moment is still chosen', () => {
    const plan = { trigger: 'stress', action: { kind: 'custom', text: text('Call Sam') } } as const;
    expect(effectivePlan(answers({ riskMoments: ['stress'], plan }))).toEqual(plan);
  });

  it('fall back to any urge when the risk moment was unselected afterwards', () => {
    const plan = {
      trigger: 'stress',
      action: { kind: 'preset', id: 'walk-ten-minutes' },
    } as const;
    expect(effectivePlan(answers({ riskMoments: ['weekend'], plan }))).toEqual({
      trigger: 'urge',
      action: { kind: 'preset', id: 'walk-ten-minutes' },
    });
  });
});

describe('samePlan', () => {
  const custom = { trigger: 'stress', action: { kind: 'custom', text: text('Call Sam') } } as const;

  it('compares the trigger and the action', () => {
    expect(samePlan(DEFAULT_PLAN, { ...DEFAULT_PLAN })).toBe(true);
    expect(
      samePlan(custom, { ...custom, action: { kind: 'custom', text: text('Call Sam') } }),
    ).toBe(true);
    expect(samePlan(DEFAULT_PLAN, { ...DEFAULT_PLAN, trigger: 'stress' })).toBe(false);
    expect(
      samePlan(DEFAULT_PLAN, {
        ...DEFAULT_PLAN,
        action: { kind: 'preset', id: 'walk-ten-minutes' },
      }),
    ).toBe(false);
    expect(
      samePlan(custom, { ...custom, action: { kind: 'custom', text: text('Call Max') } }),
    ).toBe(false);
  });

  it('tells a preset action from a custom one', () => {
    expect(samePlan(DEFAULT_PLAN, { ...DEFAULT_PLAN, action: custom.action })).toBe(false);
    expect(samePlan({ ...DEFAULT_PLAN, action: custom.action }, DEFAULT_PLAN)).toBe(false);
  });
});

describe('opensJournal', () => {
  it('is true only for the preset action that writes in the journal', () => {
    const journal = { kind: 'preset', id: 'journal-three-lines' } as const;
    expect(opensJournal({ ...DEFAULT_PLAN, action: journal })).toBe(true);
    expect(opensJournal(DEFAULT_PLAN)).toBe(false);
    expect(
      opensJournal({
        ...DEFAULT_PLAN,
        action: { kind: 'custom', text: text('journal-three-lines') },
      }),
    ).toBe(false);
  });
});

describe('finishOnboarding', () => {
  it('starts the journey now by default and keeps every answer', () => {
    const chosen = answers({
      reasons: [{ kind: 'preset', id: 'sleep' }],
      riskMoments: ['boredom'],
    });
    expect(unwrap(finishOnboarding(chosen, NOW, TODAY))).toEqual({
      journey: journeyOf(NOW),
      reasons: [{ kind: 'preset', id: 'sleep' }],
      riskMoments: ['boredom'],
      plans: [DEFAULT_PLAN],
      lock: DEFAULT_LOCK_SETTINGS,
      reminders: DEFAULT_REMINDER_SETTINGS,
    });
  });

  it('starts the journey at a chosen past date', () => {
    const at = NOW - 3 * MS_PER_DAY;
    const result = unwrap(finishOnboarding(answers({ start: { kind: 'past', at } }), NOW, TODAY));
    expect(result.journey).toEqual(journeyOf(at));
  });

  it('refuses a start in the future, as when the clock was moved back after choosing', () => {
    const at = NOW + 1;
    expect(finishOnboarding(answers({ start: { kind: 'past', at } }), NOW, TODAY)).toEqual(
      err('start-in-future'),
    );
  });

  it('stores the lock and the check-in reminder only when they were turned on', () => {
    const result = unwrap(
      finishOnboarding(answers({ protection: { lock: true, checkInReminder: true } }), NOW, TODAY),
    );
    expect(result.lock).toEqual({ ...DEFAULT_LOCK_SETTINGS, enabled: true });
    expect(result.reminders.checkIn).toEqual({ on: true, minute: 21 * 60 });
    expect(result.reminders.checkInSince).toBe(TODAY);
    expect(result.reminders.thought.on).toBe(false);
  });

  it('refuses an invalid start', () => {
    expect(
      finishOnboarding(answers({ start: { kind: 'past', at: Number.NaN } }), NOW, TODAY),
    ).toEqual(err('invalid-timestamp'));
  });
});
