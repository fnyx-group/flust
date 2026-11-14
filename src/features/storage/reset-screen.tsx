import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FailureScreen } from '@/features/storage/storage-failure';
import { StorageMessageScreen } from '@/features/storage/storage-message-screen';
import { Button } from '@/ui/button';

type ResetScreenProps = {
  reason: Extract<FailureScreen, { kind: 'reset' }>['reason'];
  onRetry: () => void;
  onReset: () => void;
};

// Erasing cannot be undone, so it takes two explicit steps: the explanation, then a confirmation.
export function ResetScreen({ reason, onRetry, onReset }: ResetScreenProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <StorageMessageScreen
        title={t('storage.reset.confirm.title')}
        paragraphs={[t('storage.reset.confirm.body')]}
        actions={
          <>
            <Button label={t('storage.reset.confirm.erase')} onPress={onReset} />
            <Button
              label={t('storage.reset.confirm.cancel')}
              variant="secondary"
              onPress={() => setConfirming(false)}
            />
          </>
        }
      />
    );
  }

  return (
    <StorageMessageScreen
      title={t('storage.reset.title')}
      paragraphs={[t(`storage.reset.reasons.${reason}`), t('storage.reset.noRecovery')]}
      actions={
        <>
          <Button label={t('storage.reset.startOver')} onPress={() => setConfirming(true)} />
          <Button label={t('storage.reset.retry')} variant="secondary" onPress={onRetry} />
        </>
      }
    />
  );
}
