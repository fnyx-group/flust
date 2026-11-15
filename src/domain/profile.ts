import { samePlan, triggerOptions, type Plan, type Reason } from '@/domain/onboarding';
import { REASON_IDS, type PlanTrigger, type ReasonId, type RiskMomentId } from '@/domain/presets';
import { err, ok, type Result } from '@/domain/result';

// The emergency screen lists every reason and every plan, so both stay short enough to read in
// the middle of an urge.
export const MAX_REASONS = 10;
export const MAX_PLANS = 5;

// A stored reason or plan with the id of its row. Rows are edited in place, by id, so that a
// lapse can tell whether the plan it changed is still the one it set.
export type ReasonEntry = { readonly id: number; readonly reason: Reason };
export type PlanEntry = { readonly id: number; readonly plan: Plan };

export type SaveReasonError = 'too-many-reasons' | 'same-reason';
export type SavePlanError = 'too-many-plans' | 'same-plan';
export type RemovePlanError = 'last-plan';

export function sameReason(a: Reason, b: Reason): boolean {
  if (a.kind === 'preset') return b.kind === 'preset' && a.id === b.id;
  return b.kind === 'custom' && a.text === b.text;
}

export function canAddReason(reasons: readonly ReasonEntry[]): boolean {
  return reasons.length < MAX_REASONS;
}

export function canAddPlan(plans: readonly PlanEntry[]): boolean {
  return plans.length < MAX_PLANS;
}

// `id` is null for a new reason. Editing is always allowed, even above the limit, so a list
// written before the limit existed can still be fixed.
export function checkReason(
  reasons: readonly ReasonEntry[],
  id: number | null,
  reason: Reason,
): Result<Reason, SaveReasonError> {
  if (id === null && !canAddReason(reasons)) return err('too-many-reasons');
  const others = reasons.filter((entry) => entry.id !== id);
  if (others.some((entry) => sameReason(entry.reason, reason))) return err('same-reason');
  return ok(reason);
}

export function checkPlan(
  plans: readonly PlanEntry[],
  id: number | null,
  plan: Plan,
): Result<Plan, SavePlanError> {
  if (id === null && !canAddPlan(plans)) return err('too-many-plans');
  const others = plans.filter((entry) => entry.id !== id);
  if (others.some((entry) => samePlan(entry.plan, plan))) return err('same-plan');
  return ok(plan);
}

// The emergency screen always has a plan to show.
export function checkPlanRemoval(
  plans: readonly PlanEntry[],
  id: number,
): Result<void, RemovePlanError> {
  return plans.some((entry) => entry.id !== id) ? ok(undefined) : err('last-plan');
}

// The presets a reason can take: those no other reason uses yet.
export function reasonPresetOptions(
  reasons: readonly ReasonEntry[],
  id: number | null,
): ReasonId[] {
  const taken = reasons.flatMap((entry) =>
    entry.id !== id && entry.reason.kind === 'preset' ? [entry.reason.id] : [],
  );
  return REASON_IDS.filter((preset) => !taken.includes(preset));
}

// The triggers the onboarding offers, plus the current one when its risk moment is no longer
// chosen, so the plan shown is always one of the options. Unchecking a risk moment never rewrites
// a saved plan: that would change it behind the user's back.
export function planTriggerOptions(
  moments: readonly RiskMomentId[],
  current: PlanTrigger,
): PlanTrigger[] {
  const options = triggerOptions(moments);
  return options.includes(current) ? options : [current, ...options];
}
