import type { CustomText } from '@/domain/custom-text';
import { isOneOf } from '@/domain/guards';
import { createJourney, type CreateJourneyError, type Journey } from '@/domain/journey';
import { DEFAULT_LOCK_SETTINGS, type LockSettings } from '@/domain/lock';
import {
  REASON_IDS,
  RISK_MOMENT_IDS,
  URGE_TRIGGER,
  type ActionId,
  type PlanTrigger,
  type ReasonId,
  type RiskMomentId,
} from '@/domain/presets';
import {
  DEFAULT_REMINDER_SETTINGS,
  setCheckInReminder,
  type ReminderSettings,
} from '@/domain/reminders';
import { err, ok, type Result } from '@/domain/result';
import type { Timestamp } from '@/domain/time';

// The welcome step has no progress bar: it is the door, not a question.
export const QUESTION_STEPS = ['reasons', 'risk-moments', 'plan', 'start'] as const;

export const ONBOARDING_STEPS = ['welcome', ...QUESTION_STEPS] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type QuestionStep = (typeof QUESTION_STEPS)[number];

export type StepProgress = { readonly current: number; readonly total: number };

export type Reason = { kind: 'preset'; id: ReasonId } | { kind: 'custom'; text: CustomText };

export type PlanAction = { kind: 'preset'; id: ActionId } | { kind: 'custom'; text: CustomText };

export type Plan = { readonly trigger: PlanTrigger; readonly action: PlanAction };

export type StartChoice = { kind: 'now' } | { kind: 'past'; at: Timestamp };

// Both are off until the person turns them on: the lock once the device has confirmed it can
// unlock, the reminder once notifications are allowed.
export type Protection = { readonly lock: boolean; readonly checkInReminder: boolean };

const NO_PROTECTION: Protection = { lock: false, checkInReminder: false };

export type OnboardingAnswers = {
  readonly reasons: readonly Reason[];
  readonly riskMoments: readonly RiskMomentId[];
  readonly plan: Plan | null;
  readonly start: StartChoice;
  readonly protection: Protection;
};

export type OnboardingDraft = {
  readonly step: OnboardingStep;
  readonly answers: OnboardingAnswers;
};

export type OnboardingResult = {
  readonly journey: Journey;
  readonly reasons: readonly Reason[];
  readonly riskMoments: readonly RiskMomentId[];
  readonly plans: readonly Plan[];
  readonly lock: LockSettings;
  readonly reminders: ReminderSettings;
};

export const DEFAULT_PLAN: Plan = {
  trigger: URGE_TRIGGER,
  action: { kind: 'preset', id: 'guided-breathing' },
};

// Every answer starts empty, so a skipped step keeps the defaults: no reasons, no risk moments,
// the default plan, a start now, and no lock or reminder.
export const EMPTY_DRAFT: OnboardingDraft = {
  step: 'welcome',
  answers: {
    reasons: [],
    riskMoments: [],
    plan: null,
    start: { kind: 'now' },
    protection: NO_PROTECTION,
  },
};

export const isOnboardingStep = isOneOf(ONBOARDING_STEPS);

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) - 1] ?? null;
}

export function stepProgress(step: QuestionStep): StepProgress {
  return { current: QUESTION_STEPS.indexOf(step) + 1, total: QUESTION_STEPS.length };
}

export function toggleReason(reasons: readonly Reason[], id: ReasonId): Reason[] {
  const presets = presetReasons(reasons);
  const next = presets.includes(id) ? presets.filter((other) => other !== id) : [...presets, id];
  return withPresetReasons(reasons, next);
}

// The onboarding offers a single custom reason, kept after the presets.
export function setCustomReason(reasons: readonly Reason[], text: CustomText | null): Reason[] {
  const presets = reasons.filter((reason) => reason.kind === 'preset');
  return text === null ? presets : [...presets, { kind: 'custom', text }];
}

export function customReason(reasons: readonly Reason[]): CustomText | null {
  const custom = reasons.find((reason) => reason.kind === 'custom');
  return custom?.kind === 'custom' ? custom.text : null;
}

export function toggleRiskMoment(
  moments: readonly RiskMomentId[],
  id: RiskMomentId,
): RiskMomentId[] {
  const selected = moments.includes(id)
    ? moments.filter((other) => other !== id)
    : [...moments, id];
  return RISK_MOMENT_IDS.filter((moment) => selected.includes(moment));
}

export function triggerOptions(moments: readonly RiskMomentId[]): PlanTrigger[] {
  return [...RISK_MOMENT_IDS.filter((moment) => moments.includes(moment)), URGE_TRIGGER];
}

// A trigger whose risk moment was unselected afterwards falls back to any urge, so the plan
// never points at a moment the user no longer chose.
export function effectivePlan(answers: OnboardingAnswers): Plan {
  const plan = answers.plan ?? DEFAULT_PLAN;
  return triggerOptions(answers.riskMoments).includes(plan.trigger)
    ? plan
    : { ...plan, trigger: URGE_TRIGGER };
}

export function samePlan(a: Plan, b: Plan): boolean {
  return a.trigger === b.trigger && sameAction(a.action, b.action);
}

// The plan whose action is to write in the journal, which the emergency screen can open.
export function opensJournal(plan: Plan): boolean {
  return plan.action.kind === 'preset' && plan.action.id === 'journal-three-lines';
}

function sameAction(a: PlanAction, b: PlanAction): boolean {
  if (a.kind === 'preset') return b.kind === 'preset' && a.id === b.id;
  return b.kind === 'custom' && a.text === b.text;
}

// `today` is the local day number at `now`, from which the check-in reminder counts.
export function finishOnboarding(
  answers: OnboardingAnswers,
  now: Timestamp,
  today: number,
): Result<OnboardingResult, CreateJourneyError> {
  const start = answers.start.kind === 'now' ? now : answers.start.at;
  const journey = createJourney(start, now);
  if (!journey.ok) return err(journey.error);
  return ok({
    journey: journey.value,
    reasons: answers.reasons,
    riskMoments: answers.riskMoments,
    plans: [effectivePlan(answers)],
    lock: { ...DEFAULT_LOCK_SETTINGS, enabled: answers.protection.lock },
    reminders: setCheckInReminder(
      DEFAULT_REMINDER_SETTINGS,
      answers.protection.checkInReminder,
      today,
    ),
  });
}

function presetReasons(reasons: readonly Reason[]): ReasonId[] {
  return reasons.flatMap((reason) => (reason.kind === 'preset' ? [reason.id] : []));
}

function withPresetReasons(reasons: readonly Reason[], ids: readonly ReasonId[]): Reason[] {
  const presets: Reason[] = REASON_IDS.filter((id) => ids.includes(id)).map((id) => ({
    kind: 'preset',
    id,
  }));
  const custom = customReason(reasons);
  return custom === null ? presets : [...presets, { kind: 'custom', text: custom }];
}
