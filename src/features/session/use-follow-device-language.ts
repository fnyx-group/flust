import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { SettingsRepository } from '@/data/settings-repository';
import { followDeviceLanguage } from '@/features/session/follow-device-language';
import { i18n } from '@/lib/i18n';
import { getDeviceLanguage } from '@/lib/i18n/language';

// With the device language chosen, a change of the phone's language made while flust runs in the
// background shows when it comes back. iOS restarts apps for it, Android does not.
export function useFollowDeviceLanguage(settings: SettingsRepository): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void followDeviceLanguage(settings, getDeviceLanguage(), i18n);
    });
    return () => subscription.remove();
  }, [settings]);
}
