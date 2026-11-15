import { useTranslation } from 'react-i18next';

import { StorageMessageScreen } from '@/features/storage/storage-message-screen';
import { Button } from '@/ui/button';

// Part of the data may already be gone, so trying again erases again: opening what is left would
// bring back a half-erased journey.
export function EraseFailedScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <StorageMessageScreen
      title={t('erase.failed.title')}
      paragraphs={[t('erase.failed.body')]}
      actions={<Button label={t('erase.failed.retry')} onPress={onRetry} />}
    />
  );
}
