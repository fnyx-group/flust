import {
  ACTION_IDS,
  isActionId,
  isPlanTrigger,
  isReasonId,
  isRiskMomentId,
  REASON_IDS,
  RISK_MOMENT_IDS,
  URGE_TRIGGER,
} from '@/domain/presets';

describe('presets', () => {
  it('have unique ids', () => {
    for (const ids of [REASON_IDS, RISK_MOMENT_IDS, ACTION_IDS]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keep the urge trigger apart from the risk moments', () => {
    expect(isRiskMomentId(URGE_TRIGGER)).toBe(false);
    expect(isPlanTrigger(URGE_TRIGGER)).toBe(true);
  });

  it('recognize their own ids only', () => {
    expect(REASON_IDS.every(isReasonId)).toBe(true);
    expect(RISK_MOMENT_IDS.every(isRiskMomentId)).toBe(true);
    expect(RISK_MOMENT_IDS.every(isPlanTrigger)).toBe(true);
    expect(ACTION_IDS.every(isActionId)).toBe(true);

    for (const guard of [isReasonId, isRiskMomentId, isPlanTrigger, isActionId]) {
      expect(guard('unknown')).toBe(false);
      expect(guard(null)).toBe(false);
      expect(guard(1)).toBe(false);
    }
    expect(isReasonId('stress')).toBe(false);
    expect(isActionId('sleep')).toBe(false);
  });
});
