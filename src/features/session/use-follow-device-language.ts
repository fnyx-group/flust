import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { SettingsRepository } from '@/data/settings-repository';
import { i18n } from '@/lib/i18n';
import { getDeviceLanguage, languageOf, toPreference } from '@/lib/i18n/language';

// With the device language chosen, a change of the phone's language made while flust runs in the
// background shows when it comes back. iOS restarts apps for it, Android does not. A setting that
// cannot be read changes nothing.
export function useFollowDeviceLanguage(settings: SettingsRepository): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      void settings.loadLanguage().then((stored) => {
        if (!stored.ok) return;
        const language = languageOf(toPreference(stored.value), getDeviceLanguage());
        if (language !== i18n.language) void i18n.changeLanguage(language);
      });
    });
    return () => subscription.remove();
  }, [settings]);
}
