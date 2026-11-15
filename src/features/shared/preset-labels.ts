import type { TFunction } from 'i18next';

import type { Plan, PlanAction } from '@/domain/onboarding';
import {
  type ActionId,
  type PlaceId,
  type PlanTrigger,
  type ReasonId,
  type RiskMomentId,
} from '@/domain/presets';

export function reasonLabel(t: TFunction, id: ReasonId): string {
  return t(`presets.reasons.${id}`);
}

export function riskMomentLabel(t: TFunction, id: RiskMomentId): string {
  return t(`presets.riskMoments.${id}`);
}

export function actionLabel(t: TFunction, id: ActionId): string {
  return t(`presets.actions.${id}`);
}

export function placeLabel(t: TFunction, id: PlaceId): string {
  return t(`presets.places.${id}`);
}

// The condition and the action as they read inside the plan sentence, after "If" and "then":
// "stress builds up", "I go out for a ten-minute walk". Two-column plans use them too, so they
// read the same as the sentence. The user's own action is kept exactly as written.
export function planCondition(t: TFunction, trigger: PlanTrigger): string {
  return t(`presets.sentences.conditions.${trigger}`);
}

export function planAction(t: TFunction, action: PlanAction): string {
  return action.kind === 'preset' ? t(`presets.sentences.actions.${action.id}`) : action.text;
}

// "If stress builds up, then I go out for a ten-minute walk." The user's own action is quoted
// after a colon instead, since changing its first letter could break a name.
export function planSentence(t: TFunction, { trigger, action }: Plan): string {
  const condition = planCondition(t, trigger);
  return t(action.kind === 'preset' ? 'presets.sentences.plan' : 'presets.sentences.planCustom', {
    condition,
    action: planAction(t, action),
  });
}
