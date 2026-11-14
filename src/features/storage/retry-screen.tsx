import { useTranslation } from 'react-i18next';

import type { FailureScreen } from '@/features/storage/storage-failure';
import { StorageMessageScreen } from '@/features/storage/storage-message-screen';
import { Button } from '@/ui/button';

type RetryScreenProps = {
  reason: Extract<FailureScreen, { kind: 'retry' }>['reason'];
  onRetry: () => void;
};

export function RetryScreen({ reason, onRetry }: RetryScreenProps) {
  const { t } = useTranslation();
  return (
    <StorageMessageScreen
      title={t('storage.retry.title')}
      paragraphs={[t(`storage.retry.reasons.${reason}`)]}
      actions={<Button label={t('storage.retry.action')} onPress={onRetry} />}
    />
  );
}
