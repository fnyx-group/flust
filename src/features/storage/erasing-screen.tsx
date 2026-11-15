import { useTranslation } from 'react-i18next';

import { StorageMessageScreen } from '@/features/storage/storage-message-screen';

// Shown while storage closes and the files go, so the screen is never blank meanwhile.
export function ErasingScreen() {
  const { t } = useTranslation();
  return <StorageMessageScreen title={t('erase.erasing')} paragraphs={[]} actions={null} />;
}
