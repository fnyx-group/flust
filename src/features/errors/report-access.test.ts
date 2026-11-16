import { canOpenReport } from '@/features/errors/report-access';
import type { AuthOutcome } from '@/features/lock/auth-outcome';
import type { DeviceSecurity } from '@/features/lock/local-auth';

function setUp(reads: DeviceSecurity['kind'][], outcome: AuthOutcome) {
  const asked: string[] = [];
  const deps = {
    security: async (): Promise<DeviceSecurity> => {
      const kind = reads.shift() ?? 'unknown';
      return kind === 'biometric' ? { kind, biometric: 'face' } : { kind };
    },
    authenticate: async () => {
      asked.push('authenticate');
      return outcome;
    },
  };
  return { asked, open: () => canOpenReport(deps) };
}

describe('canOpenReport', () => {
  it('opens without asking only when a read confirms the phone has no screen lock', async () => {
    const { asked, open } = setUp(['none'], 'failed');

    expect(await open()).toBe(true);
    expect(asked).toEqual([]);
  });

  it.each<DeviceSecurity['kind']>(['passcode', 'biometric', 'unknown'])(
    'asks the phone first when its state is %p, and opens once it confirms',
    async (kind) => {
      const { asked, open } = setUp([kind], 'success');

      expect(await open()).toBe(true);
      expect(asked).toEqual(['authenticate']);
    },
  );

  it.each<AuthOutcome>(['failed', 'cancelled', 'interrupted', 'lockout'])(
    'stays closed when the check ends as %p',
    async (outcome) => {
      const { open } = setUp(['passcode'], outcome);

      expect(await open()).toBe(false);
    },
  );

  it('opens when the check finds no screen lock any more and a new read confirms it', async () => {
    expect(await setUp(['passcode', 'none'], 'unavailable').open()).toBe(true);
    expect(await setUp(['unknown', 'unknown'], 'unavailable').open()).toBe(false);
  });
});
