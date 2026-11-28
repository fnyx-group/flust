import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorReportView } from '@/features/errors/error-report-view';
import { canOpenReport } from '@/features/errors/report-access';
import { authenticate, deviceSecurity } from '@/features/lock/local-auth';
import { EraseView } from '@/features/settings/erase-view';
import { createAppEraseFlow } from '@/features/storage/app-erase-flow';
import { EraseFailedScreen } from '@/features/storage/erase-failed-screen';
import type { EraseStep } from '@/features/storage/erase-flow';
import { ErasingScreen } from '@/features/storage/erasing-screen';
import { Button } from '@/ui/button';
import { MessageScreen } from '@/ui/message-screen';

type SafeModeView = 'choices' | 'report' | 'erase' | 'erasing' | 'erase-failed';

type SafeModeScreenProps = {
  onRetry: () => void;
  onErased: () => void;
};

// Opens neither storage nor the session, and shows no data, so it sits outside the lock: the lock
// settings live in the database that may be what fails. The error report asks for the phone's
// own check first; erasing does not, since uninstalling erases the same data. See
// docs/decisions/0028-error-boundaries-and-safe-mode.md.
export function SafeModeScreen({ onRetry, onErased }: SafeModeScreenProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<SafeModeView>('choices');
  const [checking, setChecking] = useState(false);
  const [reportRefused, setReportRefused] = useState(false);
  const [eraseFlow] = useState(() =>
    createAppEraseFlow((step: EraseStep) => (step === 'erased' ? onErased() : setView(step))),
  );

  async function openReport() {
    setChecking(true);
    setReportRefused(false);
    const allowed = await canOpenReport({
      security: deviceSecurity,
      authenticate: () =>
        authenticate({
          prompt: t('errors.safeMode.reportPrompt'),
          cancel: t('errors.safeMode.reportCancel'),
        }),
    });
    setChecking(false);
    if (allowed) setView('report');
    else setReportRefused(true);
  }

  switch (view) {
    case 'report':
      return <ErrorReportView onBack={() => setView('choices')} />;
    case 'erase':
      return (
        <EraseView
          onBack={() => setView('choices')}
          onErase={() => void eraseFlow.eraseWithoutStorage()}
        />
      );
    case 'erasing':
      return <ErasingScreen />;
    case 'erase-failed':
      return <EraseFailedScreen onRetry={() => void eraseFlow.eraseWithoutStorage()} />;
    case 'choices':
      return (
        <MessageScreen
          title={t('errors.safeMode.title')}
          paragraphs={[t('errors.safeMode.stopped')]}
          notice={reportRefused ? t('errors.safeMode.reportRefused') : null}
          actions={
            <>
              <Button label={t('errors.safeMode.retry')} onPress={onRetry} />
              <Button
                variant="secondary"
                label={t('errors.safeMode.report')}
                accessibilityHint={t('errors.safeMode.reportHint')}
                disabled={checking}
                onPress={() => void openReport()}
              />
              <Button
                variant="plain"
                label={t('errors.safeMode.erase')}
                onPress={() => setView('erase')}
              />
            </>
          }
        />
      );
  }
}
