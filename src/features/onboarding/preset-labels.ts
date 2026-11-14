import type { TFunction } from 'i18next';

import type { ActionId, PlanTrigger, ReasonId, RiskMomentId } from '@/domain/presets';

export function reasonLabel(t: TFunction, id: ReasonId): string {
  return t(`presets.reasons.${id}`);
}

export function riskMomentLabel(t: TFunction, id: RiskMomentId): string {
  return t(`presets.riskMoments.${id}`);
}

export function triggerLabel(t: TFunction, trigger: PlanTrigger): string {
  return trigger === 'urge' ? t('presets.triggers.urge') : riskMomentLabel(t, trigger);
}

export function actionLabel(t: TFunction, id: ActionId): string {
  return t(`presets.actions.${id}`);
}
