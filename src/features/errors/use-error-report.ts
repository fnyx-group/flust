import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { errorLog } from '@/data/native';
import { formatReport } from '@/domain/error-log';
import { appVersion } from '@/features/settings/app-version';

export type ErrorReport = { status: 'loading' } | { status: 'ready'; count: number; text: string };

// The text is built once per load, and that same text is shown and shared, so what the person
// reads is exactly what leaves.
export function useErrorReport() {
  const [report, setReport] = useState<ErrorReport>({ status: 'loading' });
  const [load, setLoad] = useState(0);
  const [clearFailed, setClearFailed] = useState(false);

  useEffect(() => {
    let active = true;
    errorLog.entries().then((entries) => {
      if (!active) return;
      const text = formatReport(entries, {
        now: Date.now(),
        version: appVersion() ?? null,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
      });
      setReport({ status: 'ready', count: entries.length, text });
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function clear() {
    const result = await errorLog.clear();
    setClearFailed(!result.ok);
    setLoad((count) => count + 1);
  }

  return { report, clearFailed, clear };
}
