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

export type ReasonId = (typeof REASON_IDS)[number];
export type RiskMomentId = (typeof RISK_MOMENT_IDS)[number];
export type PlanTrigger = RiskMomentId | typeof URGE_TRIGGER;
export type ActionId = (typeof ACTION_IDS)[number];

export function isReasonId(value: unknown): value is ReasonId {
  return (REASON_IDS as readonly unknown[]).includes(value);
}

export function isRiskMomentId(value: unknown): value is RiskMomentId {
  return (RISK_MOMENT_IDS as readonly unknown[]).includes(value);
}

export function isPlanTrigger(value: unknown): value is PlanTrigger {
  return value === URGE_TRIGGER || isRiskMomentId(value);
}

export function isActionId(value: unknown): value is ActionId {
  return (ACTION_IDS as readonly unknown[]).includes(value);
}
