import { useEffect } from 'react';

import { filterBridge, filterDevSettingOn } from '@/features/filter/filter-native';

// Brings the filter back when flust opens, if it was on and Android stopped it or refused to
// start it at boot. Only where the filter runs, behind its development setting for now.
export function useFilterResume() {
  useEffect(() => {
    if (filterDevSettingOn()) void filterBridge.resume();
  }, []);
}
