import type { TFunction } from 'i18next';

import type { Plan } from '@/domain/onboarding';
import {
  URGE_TRIGGER,
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

export function triggerLabel(t: TFunction, trigger: PlanTrigger): string {
  return trigger === URGE_TRIGGER ? t('presets.triggers.urge') : riskMomentLabel(t, trigger);
}

export function actionLabel(t: TFunction, id: ActionId): string {
  return t(`presets.actions.${id}`);
}

export function placeLabel(t: TFunction, id: PlaceId): string {
  return t(`presets.places.${id}`);
}

// "If stress builds up, then I go out for a ten-minute walk." The user's own action is quoted
// after a colon instead, exactly as written, since changing its first letter could break a name.
export function planSentence(t: TFunction, { trigger, action }: Plan): string {
  const condition = t(`presets.sentences.conditions.${trigger}`);
  return action.kind === 'preset'
    ? t('presets.sentences.plan', {
        condition,
        action: t(`presets.sentences.actions.${action.id}`),
      })
    : t('presets.sentences.planCustom', { condition, action: action.text });
}
