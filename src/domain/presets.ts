import { isOneOf } from '@/domain/guards';

// Ids are stored on the device and translated on display, so a released id is never renamed.

export const REASON_IDS = [
  'loved-ones',
  'energy',
  'self-esteem',
  'sleep',
  'focus',
  'relationship',
  'confidence',
] as const;

export const RISK_MOMENT_IDS = [
  'in-bed-at-night',
  'alone-at-home',
  'stress',
  'tiredness',
  'boredom',
  'after-social-media',
  'after-alcohol',
  'weekend',
] as const;

// Plans can also start from any urge, not only from a chosen risk moment.
export const URGE_TRIGGER = 'urge';

export const ACTION_IDS = [
  'phone-out-of-room',
  'guided-breathing',
  'journal-three-lines',
  'walk-ten-minutes',
] as const;

// Where a lapse happened, asked on the lapse screen.
export const PLACE_IDS = [
  'bedroom',
  'bathroom',
  'living-room',
  'work',
  'transport',
  'elsewhere',
] as const;

export type ReasonId = (typeof REASON_IDS)[number];
export type RiskMomentId = (typeof RISK_MOMENT_IDS)[number];
export type PlanTrigger = RiskMomentId | typeof URGE_TRIGGER;
export type ActionId = (typeof ACTION_IDS)[number];
export type PlaceId = (typeof PLACE_IDS)[number];

export const isReasonId = isOneOf(REASON_IDS);

export const isRiskMomentId = isOneOf(RISK_MOMENT_IDS);

export function isPlanTrigger(value: unknown): value is PlanTrigger {
  return value === URGE_TRIGGER || isRiskMomentId(value);
}

export const isActionId = isOneOf(ACTION_IDS);

export const isPlaceId = isOneOf(PLACE_IDS);
