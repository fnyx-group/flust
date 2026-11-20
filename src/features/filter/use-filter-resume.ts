import { useEffect } from 'react';

import { filterBridge } from '@/features/filter/filter-native';
import { filterStatusChanged } from '@/features/filter/use-filter-status';

// Brings the filter back when flust opens, if it was on and Android stopped it or refused to
// start it at boot. Home read the status before the tunnel was up, so it reads it again after.
export function useFilterResume() {
  useEffect(() => {
    void filterBridge.resume().then(filterStatusChanged);
  }, []);
}
