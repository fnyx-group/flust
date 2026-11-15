import { screenPrivacyOn } from '@/features/lock/screen-privacy-config';
import { flustPrivacy } from '@/features/shared/flust-privacy';

// FLAG_SECURE hides the app in recents and blocks screenshots and screen recording. It is set by
// modules/flust-privacy: expo-screen-capture is not linked on Android (docs/decisions/0025).
export function protectScreen(): void {
  if (!screenPrivacyOn()) return;
  void flustPrivacy?.setSecure?.(true).catch(() => undefined);
}
