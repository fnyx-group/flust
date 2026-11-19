import { useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import { enableFilter } from '@/features/filter/filter-actions';
import { filterBridge } from '@/features/filter/filter-native';

export type EnableNotice = 'refused' | 'failed' | null;

// Turning the filter on, with Google Play's disclosure shown first whenever Android's VPN dialog
// will follow (docs/decisions/0042-filter-onboarding-and-disclosure.md).
export function useEnableFilter(onChange: () => void) {
  const { t } = useTranslation();
  const [disclosing, setDisclosing] = useState(false);
  const [notice, setNotice] = useState<EnableNotice>(null);
  const [busy, setBusy] = useState(false);
  // State updates land one render later, so a second tap in the same frame still sees busy false.
  const running = useRef(false);

  async function run(youtubeStrict: boolean, disclosed: boolean) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setNotice(null);
    const outcome = await enableFilter(filterBridge, youtubeStrict, disclosed);
    running.current = false;
    setBusy(false);
    onChange();
    if (outcome === 'needs-disclosure') {
      setDisclosing(true);
      return;
    }
    if (outcome === 'refused' || outcome === 'failed') {
      setNotice(outcome);
      // Android reads the notice through its live region; iOS has none.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t(`filter.${outcome}`));
    }
  }

  return {
    busy,
    notice,
    disclosing,
    enable: (youtubeStrict: boolean) => run(youtubeStrict, false),
    accept: (youtubeStrict: boolean) => {
      setDisclosing(false);
      return run(youtubeStrict, true);
    },
    decline: () => setDisclosing(false),
  };
}
