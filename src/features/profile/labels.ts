import type { TFunction } from 'i18next';

import type { Plan, Reason } from '@/domain/onboarding';
import { planAction, planCondition, reasonLabel } from '@/features/shared/preset-labels';

export function reasonText(t: TFunction, reason: Reason): string {
  return reason.kind === 'preset' ? reasonLabel(t, reason.id) : reason.text;
}

// The two columns of a plan row, worded exactly as in the plan sentence, so "If" and "Then"
// read on: "If | stress builds up", "Then | I go out for a ten-minute walk".
export function planColumns(t: TFunction, { trigger, action }: Plan) {
  return { when: planCondition(t, trigger), then: planAction(t, action) };
}
