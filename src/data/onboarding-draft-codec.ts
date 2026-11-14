import { parseCustomText, type CustomText } from '@/domain/custom-text';
import {
  EMPTY_DRAFT,
  isOnboardingStep,
  type OnboardingAnswers,
  type OnboardingDraft,
  type Plan,
  type PlanAction,
  type Reason,
  type StartChoice,
} from '@/domain/onboarding';
import { isActionId, isPlanTrigger, isReasonId, isRiskMomentId } from '@/domain/presets';
import { isValidTimestamp } from '@/domain/time';

export type EncodedDraft = { step: string; answers: string };

export function encodeDraft(draft: OnboardingDraft): EncodedDraft {
  return { step: draft.step, answers: JSON.stringify(draft.answers) };
}

// A draft is only a convenience: whatever cannot be read falls back to its default instead of
// blocking the onboarding, and the user simply answers that part again.
export function decodeDraft(step: unknown, answers: unknown): OnboardingDraft {
  return {
    step: isOnboardingStep(step) ? step : EMPTY_DRAFT.step,
    answers: decodeAnswers(typeof answers === 'string' ? parseJson(answers) : null),
  };
}

function decodeAnswers(value: unknown): OnboardingAnswers {
  const defaults = EMPTY_DRAFT.answers;
  if (!isRecord(value)) return defaults;
  return {
    reasons: decodeReasons(value.reasons),
    riskMoments: arrayOf(value.riskMoments).filter(isRiskMomentId),
    plan: decodePlan(value.plan),
    start: decodeStart(value.start),
  };
}

function decodeReasons(value: unknown): Reason[] {
  const reasons = arrayOf(value).flatMap((item): Reason[] => {
    if (!isRecord(item)) return [];
    if (item.kind === 'preset' && isReasonId(item.id)) return [{ kind: 'preset', id: item.id }];
    const text = item.kind === 'custom' ? decodeText(item.text) : null;
    return text === null ? [] : [{ kind: 'custom', text }];
  });
  const custom = reasons.find((reason) => reason.kind === 'custom');
  const presets = reasons.filter(
    (reason, index) =>
      reason.kind === 'preset' &&
      reasons.findIndex((other) => other.kind === 'preset' && other.id === reason.id) === index,
  );
  return custom ? [...presets, custom] : presets;
}

function decodePlan(value: unknown): Plan | null {
  if (!isRecord(value) || !isPlanTrigger(value.trigger)) return null;
  const action = decodeAction(value.action);
  return action === null ? null : { trigger: value.trigger, action };
}

function decodeAction(value: unknown): PlanAction | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'preset' && isActionId(value.id)) return { kind: 'preset', id: value.id };
  const text = value.kind === 'custom' ? decodeText(value.text) : null;
  return text === null ? null : { kind: 'custom', text };
}

function decodeStart(value: unknown): StartChoice {
  if (isRecord(value) && value.kind === 'past' && isTimestamp(value.at)) {
    return { kind: 'past', at: value.at };
  }
  return { kind: 'now' };
}

function decodeText(value: unknown): CustomText | null {
  if (typeof value !== 'string') return null;
  const text = parseCustomText(value);
  return text.ok ? text.value : null;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && isValidTimestamp(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
