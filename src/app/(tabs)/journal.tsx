import { useTranslation } from 'react-i18next';

import { Screen } from '@/ui/screen';
import { ScreenTitle } from '@/ui/screen-title';

export default function JournalScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScreenTitle>{t('tabs.journal')}</ScreenTitle>
    </Screen>
  );
}
