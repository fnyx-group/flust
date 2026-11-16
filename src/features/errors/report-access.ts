import type { AuthOutcome } from '@/features/lock/auth-outcome';
import type { DeviceSecurity } from '@/features/lock/local-auth';

type ReportAccessDeps = {
  security: () => Promise<DeviceSecurity>;
  authenticate: () => Promise<AuthOutcome>;
};

// Safe mode sits outside the lock, and the report's times show when flust was used, so viewing
// it asks for the phone's own check first. Same rule as the lock: an unknown device state asks,
// and only a read that confirms there is no screen lock opens it without asking.
export async function canOpenReport(deps: ReportAccessDeps): Promise<boolean> {
  if ((await deps.security()).kind === 'none') return true;
  const outcome = await deps.authenticate();
  if (outcome === 'success') return true;
  // The screen lock may have been removed since the first read: a new read must confirm it.
  return outcome === 'unavailable' && (await deps.security()).kind === 'none';
}
