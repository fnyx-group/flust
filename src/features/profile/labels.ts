import type { TFunction } from 'i18next';

import type { Reason } from '@/domain/onboarding';
import { reasonLabel } from '@/features/shared/preset-labels';

export function reasonText(t: TFunction, reason: Reason): string {
  return reason.kind === 'preset' ? reasonLabel(t, reason.id) : reason.text;
}
