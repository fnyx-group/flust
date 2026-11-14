import { arrayOf, decodePlan, decodeText, isRecord, parseJson } from '@/data/json-codec';
import {
  EMPTY_DRAFT,
  isOnboardingStep,
  type OnboardingAnswers,
  type OnboardingDraft,
  type Reason,
  type StartChoice,
} from '@/domain/onboarding';
import { isReasonId, RISK_MOMENT_IDS, type RiskMomentId } from '@/domain/presets';
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
    answers: decodeAnswers(parseJson(answers)),
  };
}

function decodeAnswers(value: unknown): OnboardingAnswers {
  const defaults = EMPTY_DRAFT.answers;
  if (!isRecord(value)) return defaults;
  return {
    reasons: decodeReasons(value.reasons),
    riskMoments: decodeRiskMoments(value.riskMoments),
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

// Stored once each and in preset order, as toggling them does: a duplicate would break the
// primary key of risk_moment and block the end of the onboarding.
function decodeRiskMoments(value: unknown): RiskMomentId[] {
  const moments = arrayOf(value);
  return RISK_MOMENT_IDS.filter((id) => moments.includes(id));
}

function decodeStart(value: unknown): StartChoice {
  if (isRecord(value) && value.kind === 'past' && isTimestamp(value.at)) {
    return { kind: 'past', at: value.at };
  }
  return { kind: 'now' };
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && isValidTimestamp(value);
}
