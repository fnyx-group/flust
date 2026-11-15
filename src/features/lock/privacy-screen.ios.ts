import { enableAppSwitcherProtectionAsync } from 'expo-screen-capture';

import { screenPrivacyOn } from '@/features/lock/screen-privacy-config';

const BLUR_INTENSITY = 1;

// A blur covers the app's snapshot in the app switcher.
export function protectScreen(): void {
  if (!screenPrivacyOn()) return;
  void enableAppSwitcherProtectionAsync(BLUR_INTENSITY).catch(() => undefined);
}
