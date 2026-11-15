import type { TFunction } from 'i18next';

import type {
  RemovePlanStorageError,
  SavePlanStorageError,
  SaveReasonStorageError,
} from '@/data/profile-repository';
import { MAX_PLANS, MAX_REASONS } from '@/domain/profile';

export type ReasonEditorError =
  Exclude<SaveReasonStorageError, 'storage-failed'> | 'save-failed' | 'remove-failed';

export type PlanEditorError =
  | Exclude<SavePlanStorageError | RemovePlanStorageError, 'storage-failed'>
  | 'save-failed'
  | 'remove-failed';

export function reasonSaveError(error: SaveReasonStorageError): ReasonEditorError {
  return error === 'storage-failed' ? 'save-failed' : error;
}

export function planSaveError(error: SavePlanStorageError): PlanEditorError {
  return error === 'storage-failed' ? 'save-failed' : error;
}

export function planRemoveError(error: RemovePlanStorageError): PlanEditorError {
  return error === 'storage-failed' ? 'remove-failed' : error;
}

// The limits are part of the message, so it says how many there already are.
export function reasonErrorMessage(t: TFunction, error: ReasonEditorError): string {
  if (error === 'too-many-reasons') return t('profile.reasonLimit', { count: MAX_REASONS });
  return t(`profile.reason.errors.${error}`);
}

export function planErrorMessage(t: TFunction, error: PlanEditorError): string {
  if (error === 'too-many-plans') return t('profile.planLimit', { count: MAX_PLANS });
  if (error === 'last-plan') return t('profile.plan.lastPlan');
  return t(`profile.plan.errors.${error}`);
}
