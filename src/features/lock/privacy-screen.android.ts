import { recordError } from '@/features/errors/report-error';
import { screenPrivacyOn } from '@/features/lock/screen-privacy-config';
import { flustPrivacy } from '@/features/shared/flust-privacy';

// FLAG_SECURE hides the app in recents and blocks screenshots and screen recording.
// modules/flust-privacy sets it as the activity is created; this call confirms it, and a failure
// is recorded in the local error log (docs/decisions/0025-screen-privacy.md).
export function protectScreen(): void {
  if (!screenPrivacyOn()) return;
  const secured = flustPrivacy?.setSecure?.(true);
  if (secured === undefined) {
    void recordError(undefined, { kind: 'screen-privacy-failed' });
    return;
  }
  void secured.catch((error: unknown) => recordError(error, { kind: 'screen-privacy-failed' }));
}
