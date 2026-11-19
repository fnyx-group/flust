import { enableAppSwitcherProtectionAsync } from 'expo-screen-capture';

import { recordError } from '@/features/errors/report-error';
import { screenPrivacyOn } from '@/features/lock/screen-privacy-config';

const BLUR_INTENSITY = 1;

// A blur covers the app's snapshot in the app switcher. A failure is recorded in the local error
// log.
export function protectScreen(): void {
  if (!screenPrivacyOn()) return;
  void enableAppSwitcherProtectionAsync(BLUR_INTENSITY).catch((error: unknown) =>
    recordError(error, { kind: 'screen-privacy-failed' }),
  );
}
