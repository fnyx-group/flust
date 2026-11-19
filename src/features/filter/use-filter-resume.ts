import { useEffect } from 'react';

import { filterBridge } from '@/features/filter/filter-native';

// Brings the filter back when flust opens, if it was on and Android stopped it or refused to
// start it at boot.
export function useFilterResume() {
  useEffect(() => {
    void filterBridge.resume();
  }, []);
}
