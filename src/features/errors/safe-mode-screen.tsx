import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorReportView } from '@/features/errors/error-report-view';
import { EraseView } from '@/features/settings/erase-view';
import { createAppEraseFlow } from '@/features/storage/app-erase-flow';
import { EraseFailedScreen } from '@/features/storage/erase-failed-screen';
import type { EraseStep } from '@/features/storage/erase-flow';
import { ErasingScreen } from '@/features/storage/erasing-screen';
import { StorageMessageScreen } from '@/features/storage/storage-message-screen';
import { Button } from '@/ui/button';

type SafeModeView = 'choices' | 'report' | 'erase' | 'erasing' | 'erase-failed';

type SafeModeScreenProps = {
  onRetry: () => void;
  onErased: () => void;
};

// Opens neither storage nor the session, and shows no data, so it sits outside the lock: the lock
// settings live in the database that may be what fails. See
// docs/decisions/0028-error-boundaries-and-safe-mode.md.
export function SafeModeScreen({ onRetry, onErased }: SafeModeScreenProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<SafeModeView>('choices');
  const [eraseFlow] = useState(() =>
    createAppEraseFlow((step: EraseStep) => (step === 'erased' ? onErased() : setView(step))),
  );

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
        <StorageMessageScreen
          title={t('errors.safeMode.title')}
          paragraphs={[t('errors.safeMode.stopped'), t('errors.safeMode.choices')]}
          actions={
            <>
              <Button label={t('errors.safeMode.retry')} onPress={onRetry} />
              <Button
                variant="secondary"
                label={t('errors.safeMode.report')}
                onPress={() => setView('report')}
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
