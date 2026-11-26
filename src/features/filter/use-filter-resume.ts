import { useEffect } from 'react';

import { filterBridge } from '@/features/filter/filter-native';
import { filterStatusChanged } from '@/features/filter/use-filter-status';
import { i18n } from '@/lib/i18n';

// Brings the filter back when flust opens, if it was on and Android stopped it or refused to
// start it at boot. Home read the status before the tunnel was up, so it reads it again after.
// The notification's words go first, so that the start uses them, and again with each change of
// language, so that the starts without flust use them too.
export function useFilterResume() {
  useEffect(() => {
    void filterBridge
      .describe()
      .then(() => filterBridge.resume())
      .then(filterStatusChanged);
    const describe = () => void filterBridge.describe();
    i18n.on('languageChanged', describe);
    return () => i18n.off('languageChanged', describe);
  }, []);
}
