import { parseCustomText } from '@/domain/custom-text';
import { DEFAULT_PLAN, type Plan } from '@/domain/onboarding';
import { ACTION_IDS, REASON_IDS } from '@/domain/presets';
import {
  canAddPlan,
  canAddReason,
  checkPlan,
  checkPlanRemoval,
  checkReason,
  MAX_PLANS,
  MAX_REASONS,
  newPlanStart,
  planTriggerOptions,
  reasonPresetOptions,
  sameReason,
  type PlanEntry,
  type ReasonEntry,
} from '@/domain/profile';
import { err, ok } from '@/domain/result';
import { unwrap } from '@test/arbitraries';

const MINE = unwrap(parseCustomText('Be free'));
const WALK: Plan = { trigger: 'stress', action: { kind: 'preset', id: 'walk-ten-minutes' } };

const REASONS: ReasonEntry[] = [
  { id: 1, reason: { kind: 'preset', id: 'sleep' } },
  { id: 2, reason: { kind: 'custom', text: MINE } },
];

const PLANS: PlanEntry[] = [
  { id: 1, plan: DEFAULT_PLAN },
  { id: 2, plan: WALK },
];

function reasonsOf(count: number): ReasonEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    reason: { kind: 'custom', text: unwrap(parseCustomText(`Reason ${index}`)) },
  }));
}

function plansOf(count: number): PlanEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    plan: {
      trigger: 'urge',
      action: { kind: 'custom', text: unwrap(parseCustomText(`${index}`)) },
    },
  }));
}

describe('sameReason', () => {
  it('compares presets by id and custom reasons by text', () => {
    expect(sameReason({ kind: 'preset', id: 'sleep' }, { kind: 'preset', id: 'sleep' })).toBe(true);
    expect(sameReason({ kind: 'preset', id: 'sleep' }, { kind: 'preset', id: 'focus' })).toBe(
      false,
    );
    expect(sameReason({ kind: 'custom', text: MINE }, { kind: 'custom', text: MINE })).toBe(true);
    expect(sameReason({ kind: 'custom', text: MINE }, { kind: 'preset', id: 'sleep' })).toBe(false);
    expect(sameReason({ kind: 'preset', id: 'sleep' }, { kind: 'custom', text: MINE })).toBe(false);
  });
});

describe('checkReason', () => {
  it('accepts a new reason that is not there yet', () => {
    const reason = { kind: 'preset', id: 'focus' } as const;
    expect(checkReason(REASONS, null, reason)).toEqual(ok(reason));
  });

  it('refuses a reason already in the list, preset or custom', () => {
    expect(checkReason(REASONS, null, { kind: 'preset', id: 'sleep' })).toEqual(err('same-reason'));
    expect(checkReason(REASONS, 1, { kind: 'custom', text: MINE })).toEqual(err('same-reason'));
  });

  it('lets a reason be saved again as it is', () => {
    expect(checkReason(REASONS, 1, { kind: 'preset', id: 'sleep' })).toEqual(
      ok({ kind: 'preset', id: 'sleep' }),
    );
  });

  it(`refuses a new reason beyond ${MAX_REASONS}, but still allows edits`, () => {
    const full = reasonsOf(MAX_REASONS);
    const reason = { kind: 'preset', id: 'focus' } as const;
    expect(canAddReason(reasonsOf(MAX_REASONS - 1))).toBe(true);
    expect(canAddReason(full)).toBe(false);
    expect(checkReason(full, null, reason)).toEqual(err('too-many-reasons'));
    expect(checkReason(full, 3, reason)).toEqual(ok(reason));
  });
});

describe('checkPlan', () => {
  it('accepts a new plan that is not there yet', () => {
    const plan: Plan = { trigger: 'boredom', action: WALK.action };
    expect(checkPlan(PLANS, null, plan)).toEqual(ok(plan));
  });

  it('refuses a plan identical to another one', () => {
    expect(checkPlan(PLANS, null, WALK)).toEqual(err('same-plan'));
    expect(checkPlan(PLANS, 1, WALK)).toEqual(err('same-plan'));
    expect(checkPlan(PLANS, 2, WALK)).toEqual(ok(WALK));
  });

  it(`refuses a new plan beyond ${MAX_PLANS}, but still allows edits`, () => {
    const full = plansOf(MAX_PLANS);
    expect(canAddPlan(plansOf(MAX_PLANS - 1))).toBe(true);
    expect(canAddPlan(full)).toBe(false);
    expect(checkPlan(full, null, WALK)).toEqual(err('too-many-plans'));
    expect(checkPlan(full, 2, WALK)).toEqual(ok(WALK));
  });
});

describe('checkPlanRemoval', () => {
  it('keeps at least one plan', () => {
    expect(checkPlanRemoval(PLANS, 1)).toEqual(ok(undefined));
    expect(checkPlanRemoval([{ id: 1, plan: DEFAULT_PLAN }], 1)).toEqual(err('last-plan'));
  });

  it('allows removing a plan that is already gone while another remains', () => {
    expect(checkPlanRemoval([{ id: 1, plan: DEFAULT_PLAN }], 9)).toEqual(ok(undefined));
    expect(checkPlanRemoval([], 9)).toEqual(err('last-plan'));
  });
});

describe('reasonPresetOptions', () => {
  it('leaves out the presets other reasons use, but keeps the one being edited', () => {
    expect(reasonPresetOptions(REASONS, null)).toEqual(REASON_IDS.filter((id) => id !== 'sleep'));
    expect(reasonPresetOptions(REASONS, 1)).toEqual([...REASON_IDS]);
  });
});

describe('planTriggerOptions', () => {
  it('offers the chosen risk moments, then any urge', () => {
    expect(planTriggerOptions(['stress', 'boredom'], 'urge')).toEqual([
      'stress',
      'boredom',
      'urge',
    ]);
  });

  it('keeps the current trigger first when its risk moment is no longer chosen', () => {
    expect(planTriggerOptions([], 'weekend')).toEqual(['weekend', 'urge']);
  });
});

describe('newPlanStart', () => {
  const entries = (plans: readonly Plan[]): PlanEntry[] =>
    plans.map((plan, index) => ({ id: index + 1, plan }));

  it('starts from the first offered trigger and preset action', () => {
    expect(newPlanStart([], ['stress'])).toEqual({
      trigger: 'stress',
      action: { kind: 'preset', id: 'phone-out-of-room' },
    });
  });

  it('skips every pair a plan already holds', () => {
    const taken = entries([
      { trigger: 'urge', action: { kind: 'preset', id: 'phone-out-of-room' } },
      DEFAULT_PLAN,
    ]);
    expect(newPlanStart(taken, [])).toEqual({
      trigger: 'urge',
      action: { kind: 'preset', id: 'journal-three-lines' },
    });
  });

  it('falls back to the default plan once every pair is taken', () => {
    const taken = entries(
      ACTION_IDS.map((id) => ({ trigger: 'urge', action: { kind: 'preset', id } })),
    );
    expect(newPlanStart(taken, [])).toEqual(DEFAULT_PLAN);
  });
});
