import Constants from 'expo-constants';
import { enableAppSwitcherProtectionAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { Platform } from 'react-native';

const BLUR_INTENSITY = 1;

// Hides the app in the app switcher. On Android this is FLAG_SECURE, which also blocks
// screenshots and screen recording of flust; on iOS a blur covers the snapshot. Off in the
// development build only, so screenshots can be taken for the docs. A config that cannot be read
// keeps the protection.
export function protectScreen(): void {
  if (Constants.expoConfig?.extra?.screenPrivacy === false) return;
  if (Platform.OS === 'android') void preventScreenCaptureAsync().catch(() => undefined);
  if (Platform.OS === 'ios') {
    void enableAppSwitcherProtectionAsync(BLUR_INTENSITY).catch(() => undefined);
  }
}
