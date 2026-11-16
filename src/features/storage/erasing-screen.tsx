import { useTranslation } from 'react-i18next';

import { MessageScreen } from '@/ui/message-screen';

// Shown while storage closes and the files go, so the screen is never blank meanwhile.
export function ErasingScreen() {
  const { t } = useTranslation();
  return <MessageScreen title={t('erase.erasing')} paragraphs={[]} actions={null} />;
}
